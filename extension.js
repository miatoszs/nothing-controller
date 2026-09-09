/**
 * Nothing & CMF Earbuds GNOME Shell Extension
 * Standalone Panel Menu Extension with Nothing OS Circular Battery Gauges
 * Clean Disconnected State & Full Control Center
 * Compatible with GNOME Shell 45, 46, 47, 48, 49, 50
 */

import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const NOTHING_EAR_DBUS_NAME = 'org.gnome.NothingEar';
const NOTHING_EAR_DBUS_PATH = '/org/gnome/NothingEar';

const RING_LINE_WIDTH = 4.5;
const RING_SIZE = 64;
const ICON_SIZE = 38;

const NothingEarInterface = `
<node>
  <interface name="org.gnome.NothingEar">
    <method name="GetState">
      <arg type="s" direction="out" name="state"/>
    </method>
    <method name="SetANCMode">
      <arg type="i" direction="in" name="mode"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="SetANCStrength">
      <arg type="i" direction="in" name="strength"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="SetEQMode">
      <arg type="i" direction="in" name="mode"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="SetCustomEQ">
      <arg type="d" direction="in" name="bass"/>
      <arg type="d" direction="in" name="mid"/>
      <arg type="d" direction="in" name="treble"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="SetEnhancedBass">
      <arg type="b" direction="in" name="enabled"/>
      <arg type="i" direction="in" name="level"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="SetInEarDetection">
      <arg type="b" direction="in" name="enabled"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="SetLowLatency">
      <arg type="b" direction="in" name="enabled"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="SetPersonalizedANC">
      <arg type="b" direction="in" name="enabled"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="RingBuds">
      <arg type="b" direction="in" name="enable"/>
      <arg type="s" direction="in" name="side"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="StartEarFitTest">
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="Refresh">
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="Reconnect">
      <arg type="b" direction="out" name="success"/>
    </method>
    <signal name="StateChanged">
      <arg type="s" name="state"/>
    </signal>
  </interface>
</node>`;

const NothingEarProxy = Gio.DBusProxy.makeProxyWrapper(NothingEarInterface);

/**
 * Circular Battery Indicator Ring with center earbud icon
 */
const BatteryIndicator = GObject.registerClass(
class BatteryIndicator extends St.BoxLayout {
    _init(type, label, gicon) {
        super._init({
            style_class: 'nothing-battery-indicator',
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._type = type;
        this._label = label;
        this._level = -1;
        this._charging = false;

        this._ring = new St.DrawingArea({
            style_class: 'nothing-battery-ring',
            width: RING_SIZE,
            height: RING_SIZE,
        });
        this._ring.connect('repaint', area => this._drawRing(area));

        this._icon = new St.Icon({
            gicon,
            icon_size: ICON_SIZE,
            style_class: 'nothing-battery-icon',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });

        this._ringBin = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_align: Clutter.ActorAlign.CENTER,
            width: RING_SIZE,
            height: RING_SIZE,
        });
        this._ringBin.add_child(this._ring);
        this._ringBin.add_child(this._icon);

        this._levelLabel = new St.Label({
            text: '--',
            style_class: 'nothing-battery-level',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._nameLabel = new St.Label({
            text: label,
            style_class: 'nothing-battery-name',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this._ringBin);
        this.add_child(this._levelLabel);
        this.add_child(this._nameLabel);
    }

    setLevel(level, charging = false) {
        if (this._level === level && this._charging === charging) return;

        this._level = level;
        this._charging = charging;

        if (level < 0) {
            this._levelLabel.text = '--';
            this._ringBin.opacity = 100;
        } else {
            this._levelLabel.text = `${level}%${charging ? ' ⚡' : ''}`;
            this._ringBin.opacity = 255;
        }

        this._ring.queue_repaint();
    }

    _drawRing(area) {
        const cr = area.get_context();
        const [width, height] = area.get_surface_size();

        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) / 2 - RING_LINE_WIDTH / 2 - 2;

        cr.setLineWidth(RING_LINE_WIDTH);

        // Background track (subtle slate circle)
        cr.setSourceRGBA(1.0, 1.0, 1.0, 0.16);
        cr.arc(cx, cy, radius, 0, 2 * Math.PI);
        cr.stroke();

        // Progress arc
        if (this._level >= 0) {
            const fraction = Math.max(0.01, Math.min(this._level, 100) / 100);

            if (this._charging) {
                cr.setSourceRGBA(0.18, 0.76, 0.49, 1.0); // Green (#2ec27e) for charging
            } else if (this._level <= 20) {
                cr.setSourceRGBA(0.88, 0.11, 0.14, 1.0); // Red (#e01b24) for critical/low (<= 20%)
            } else if (this._level <= 35) {
                cr.setSourceRGBA(0.96, 0.83, 0.18, 1.0); // Yellow/Amber (#f6d32d) for medium-low (21-35%)
            } else {
                cr.setSourceRGBA(1.0, 1.0, 1.0, 0.92); // Clean White (#ffffff) for normal/healthy battery (> 35%)
            }

            cr.setLineCap(Cairo.LineCap.ROUND);
            cr.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * fraction);
            cr.stroke();
        }

        cr.$dispose();
    }
});

/**
 * Rounded Noise Control Mode Button with vertical Icon + Label
 */
const NoiseControlButton = GObject.registerClass(
class NoiseControlButton extends St.Button {
    _init(mode, label, gicon) {
        super._init({
            style_class: 'nothing-nc-button',
            can_focus: true,
            accessible_name: label,
            x_expand: true,
            child: new St.BoxLayout({
                vertical: true,
                x_align: Clutter.ActorAlign.CENTER,
            }),
        });

        this._mode = mode;

        const icon = new St.Icon({
            gicon,
            icon_size: 20,
            style_class: 'nothing-nc-icon',
            x_align: Clutter.ActorAlign.CENTER,
        });

        const labelWidget = new St.Label({
            text: label,
            style_class: 'nothing-nc-label',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this.child.add_child(icon);
        this.child.add_child(labelWidget);
    }

    get mode() {
        return this._mode;
    }

    setActive(active) {
        if (active) {
            this.add_style_class_name('active');
        } else {
            this.remove_style_class_name('active');
        }
    }
});

const NothingEarPanelButton = GObject.registerClass(
class NothingEarPanelButton extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Nothing Earbuds'), false);
        this._extension = extension;
        this._proxy = null;
        this._state = null;
        this._signalId = 0;
        this._isRingingLeft = false;
        this._isRingingRight = false;

        const iconsDir = `${extension.path}/icons`;
        this._batteryIcons = {
            left: Gio.icon_new_for_string(`${iconsDir}/left.png`),
            right: Gio.icon_new_for_string(`${iconsDir}/right.png`),
            case: Gio.icon_new_for_string(`${iconsDir}/case.png`),
        };

        this._ncIcons = {
            nc: Gio.icon_new_for_string(`${iconsDir}/anc-on-symbolic.svg`),
            trans: Gio.icon_new_for_string(`${iconsDir}/adaptive-symbolic.svg`),
            off: Gio.icon_new_for_string(`${iconsDir}/anc-off-symbolic.svg`),
        };

        // Top bar button box (Icon + Battery/ANC Label)
        this._box = new St.BoxLayout({
            style_class: 'panel-status-indicators-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._icon = new St.Icon({
            icon_name: 'audio-headphones-symbolic',
            style_class: 'system-status-icon',
        });

        this._label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-left: 3px; font-weight: 600; font-size: 0.9em;',
        });
        this._label.hide();

        this._box.add_child(this._icon);
        this._box.add_child(this._label);
        this.add_child(this._box);

        this._buildMenu();

        // Refresh state immediately whenever the user opens the menu
        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen && this._proxy) {
                this._proxy.GetStateRemote((result, error) => {
                    if (!error && result && result[0]) {
                        try {
                            const state = JSON.parse(result[0]);
                            this._updateState(state);
                        } catch (e) {}
                    }
                });
            }
        });
    }

    setProxy(proxy) {
        this._proxy = proxy;
        if (this._proxy) {
            this._signalId = this._proxy.connectSignal('StateChanged', (proxy, sender, [stateJson]) => {
                try {
                    const state = JSON.parse(stateJson);
                    this._updateState(state);
                } catch (e) {
                    console.error('[NothingEar] Error parsing StateChanged JSON:', e);
                }
            });

            this._proxy.GetStateRemote((result, error) => {
                if (!error && result && result[0]) {
                    try {
                        const state = JSON.parse(result[0]);
                        this._updateState(state);
                    } catch (e) {
                        console.error('[NothingEar] Error parsing initial GetState:', e);
                    }
                }
            });
        }
    }

    _buildMenu() {
        // ============================================
        // 1. DISCONNECTED VIEW SECTION
        // ============================================
        this._disconnectedSection = new PopupMenu.PopupMenuSection();

        const discBox = new St.BoxLayout({
            vertical: true,
            style_class: 'nothing-disconnected-box',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        const discIcon = new St.Icon({
            icon_name: 'audio-headphones-symbolic',
            icon_size: 48,
            style_class: 'nothing-disconnected-icon',
            x_align: Clutter.ActorAlign.CENTER,
        });

        const discTitle = new St.Label({
            text: _('Nothing Earbuds Disconnected'),
            style_class: 'nothing-disconnected-title',
            x_align: Clutter.ActorAlign.CENTER,
        });

        const discSubtitle = new St.Label({
            text: _('Open case or take earbuds out to connect'),
            style_class: 'nothing-disconnected-subtitle',
            x_align: Clutter.ActorAlign.CENTER,
        });

        const connectBtn = new St.Button({
            label: _('Connect / Refresh'),
            style_class: 'button nothing-ear-mode-btn active',
            style: 'margin-top: 10px; padding: 7px 20px;',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        connectBtn.connect('clicked', () => {
            if (this._proxy) {
                this._proxy.RefreshRemote(() => {});
            }
        });

        discBox.add_child(discIcon);
        discBox.add_child(discTitle);
        discBox.add_child(discSubtitle);
        discBox.add_child(connectBtn);

        const discItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        discItem.actor.add_child(discBox);
        this._disconnectedSection.addMenuItem(discItem);
        this.menu.addMenuItem(this._disconnectedSection);

        // ============================================
        // 2. CONNECTED VIEW SECTION
        // ============================================
        this._connectedSection = new PopupMenu.PopupMenuSection();

        // 2a. Header Row (Model name + Refresh button)
        this._infoBox = new St.BoxLayout({
            style_class: 'nothing-battery-box',
            style: 'padding-bottom: 2px; padding-top: 8px;',
            x_expand: true,
        });

        this._deviceTitleLabel = new St.Label({
            text: _('Nothing Earbuds'),
            style: 'font-weight: bold; font-size: 1.1em;',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });

        this._reconnectBtn = new St.Button({
            label: _('Refresh'),
            style_class: 'button nothing-ear-strength-btn',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._reconnectBtn.connect('clicked', () => {
            if (this._proxy) {
                this._proxy.RefreshRemote(() => {});
            }
        });

        this._infoBox.add_child(this._deviceTitleLabel);
        this._infoBox.add_child(this._reconnectBtn);

        const infoItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        infoItem.actor.add_child(this._infoBox);
        this._connectedSection.addMenuItem(infoItem);

        // 2b. Circular Battery Gauges (Left, Right, Case)
        this._batteryBox = new St.BoxLayout({
            style_class: 'nothing-battery-box',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._leftBattery = new BatteryIndicator('left', _('Left'), this._batteryIcons.left);
        this._rightBattery = new BatteryIndicator('right', _('Right'), this._batteryIcons.right);
        this._caseBattery = new BatteryIndicator('case', _('Case'), this._batteryIcons.case);

        this._batteryBox.add_child(this._leftBattery);
        this._batteryBox.add_child(this._rightBattery);
        this._batteryBox.add_child(this._caseBattery);

        const battItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        battItem.actor.add_child(this._batteryBox);
        this._connectedSection.addMenuItem(battItem);

        this._connectedSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 2c. Noise Control (ANC) Header & Buttons
        const ancLabel = new St.Label({
            text: _('Noise Control'),
            style_class: 'nothing-ear-section-header',
        });
        const ancLabelItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        ancLabelItem.actor.add_child(ancLabel);
        this._connectedSection.addMenuItem(ancLabelItem);

        this._ancButtonGroup = new St.BoxLayout({
            style_class: 'nothing-nc-box',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._btnNC = new NoiseControlButton(1, _('Noise Cancellation'), this._ncIcons.nc);
        this._btnTrans = new NoiseControlButton(7, _('Transparency'), this._ncIcons.trans);
        this._btnOff = new NoiseControlButton(5, _('Off'), this._ncIcons.off);

        this._btnNC.connect('clicked', () => this._setANC(1));
        this._btnTrans.connect('clicked', () => this._setANC(7));
        this._btnOff.connect('clicked', () => this._setANC(5));

        this._ancButtonGroup.add_child(this._btnNC);
        this._ancButtonGroup.add_child(this._btnTrans);
        this._ancButtonGroup.add_child(this._btnOff);

        const ancButtonsItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        ancButtonsItem.actor.add_child(this._ancButtonGroup);
        this._connectedSection.addMenuItem(ancButtonsItem);

        // 2d. ANC Strength Sub-Buttons (High, Mid, Low, Adaptive)
        this._ancStrengthGroup = new St.BoxLayout({
            style_class: 'nothing-ear-button-group',
            x_expand: true,
            style: 'margin-top: 2px;',
        });

        this._btnHigh = this._createButton(_('High'), () => this._setANCStrength(0), 'nothing-ear-strength-btn');
        this._btnMid = this._createButton(_('Mid'), () => this._setANCStrength(2), 'nothing-ear-strength-btn');
        this._btnLow = this._createButton(_('Low'), () => this._setANCStrength(1), 'nothing-ear-strength-btn');
        this._btnAdapt = this._createButton(_('Adaptive'), () => this._setANCStrength(3), 'nothing-ear-strength-btn');

        this._ancStrengthGroup.add_child(this._btnHigh);
        this._ancStrengthGroup.add_child(this._btnMid);
        this._ancStrengthGroup.add_child(this._btnLow);
        this._ancStrengthGroup.add_child(this._btnAdapt);

        this._ancStrengthMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        this._ancStrengthMenuItem.actor.add_child(this._ancStrengthGroup);
        this._connectedSection.addMenuItem(this._ancStrengthMenuItem);

        this._connectedSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 2e. Equalizer Presets
        const eqLabel = new St.Label({
            text: _('Equalizer'),
            style_class: 'nothing-ear-section-header',
        });
        const eqLabelItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        eqLabelItem.actor.add_child(eqLabel);
        this._connectedSection.addMenuItem(eqLabelItem);

        this._eqButtonGroup = new St.BoxLayout({
            style_class: 'nothing-ear-button-group',
            x_expand: true,
        });

        this._eqBalanced = this._createButton(_('Balanced'), () => this._setEQ(0));
        this._eqVoice = this._createButton(_('Voice'), () => this._setEQ(1));
        this._eqTreble = this._createButton(_('Treble'), () => this._setEQ(2));
        this._eqBass = this._createButton(_('Bass'), () => this._setEQ(3));
        this._eqCustom = this._createButton(_('Custom'), () => this._setEQ(4));

        this._eqButtonGroup.add_child(this._eqBalanced);
        this._eqButtonGroup.add_child(this._eqVoice);
        this._eqButtonGroup.add_child(this._eqTreble);
        this._eqButtonGroup.add_child(this._eqBass);
        this._eqButtonGroup.add_child(this._eqCustom);

        const eqButtonsItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        eqButtonsItem.actor.add_child(this._eqButtonGroup);
        this._connectedSection.addMenuItem(eqButtonsItem);

        // 2f. Enhanced Bass Section
        this._bassSwitch = new PopupMenu.PopupSwitchMenuItem(_('Ultra Bass (Level 1-5)'), false);
        this._bassSwitch.connect('toggled', item => {
            const level = this._state && this._state.enhanced_bass ? this._state.enhanced_bass.level : 1;
            this._setEnhancedBass(item.state, level);
        });
        this._connectedSection.addMenuItem(this._bassSwitch);

        this._bassLevelGroup = new St.BoxLayout({
            style_class: 'nothing-ear-button-group',
            x_expand: true,
        });

        this._bassLevels = [];
        for (let i = 1; i <= 5; i++) {
            const btn = this._createButton(`${i}`, () => {
                this._setEnhancedBass(true, i);
            }, 'nothing-ear-strength-btn');
            this._bassLevels.push(btn);
            this._bassLevelGroup.add_child(btn);
        }

        this._bassLevelMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        this._bassLevelMenuItem.actor.add_child(this._bassLevelGroup);
        this._connectedSection.addMenuItem(this._bassLevelMenuItem);

        this._connectedSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 2g. Quick Switches (In-Ear Detection, Low Latency)
        this._inEarSwitch = new PopupMenu.PopupSwitchMenuItem(_('In-Ear Detection'), true);
        this._inEarSwitch.connect('toggled', item => {
            if (this._proxy) {
                this._proxy.SetInEarDetectionRemote(item.state, () => {});
            }
        });
        this._connectedSection.addMenuItem(this._inEarSwitch);

        this._latencySwitch = new PopupMenu.PopupSwitchMenuItem(_('Low Latency Mode'), false);
        this._latencySwitch.connect('toggled', item => {
            if (this._proxy) {
                this._proxy.SetLowLatencyRemote(item.state, () => {});
            }
        });
        this._connectedSection.addMenuItem(this._latencySwitch);

        this._connectedSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 2h. Find My Earbuds (Ring)
        const ringLabel = new St.Label({
            text: _('Find My Earbuds'),
            style_class: 'nothing-ear-section-header',
        });
        const ringLabelItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        ringLabelItem.actor.add_child(ringLabel);
        this._connectedSection.addMenuItem(ringLabelItem);

        this._ringBox = new St.BoxLayout({
            style_class: 'nothing-ear-button-group',
            x_expand: true,
        });

        this._ringLeftBtn = this._createButton(_('Ring Left'), () => this._toggleRing('left'));
        this._ringRightBtn = this._createButton(_('Ring Right'), () => this._toggleRing('right'));
        this._ringStopBtn = this._createButton(_('Stop'), () => this._stopRing());

        this._ringBox.add_child(this._ringLeftBtn);
        this._ringBox.add_child(this._ringRightBtn);
        this._ringBox.add_child(this._ringStopBtn);

        const ringButtonsItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
        ringButtonsItem.actor.add_child(this._ringBox);
        this._connectedSection.addMenuItem(ringButtonsItem);

        this.menu.addMenuItem(this._connectedSection);

        // ============================================
        // 3. COMMON FOOTER (Settings & Gestures)
        // ============================================
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const settingsItem = new PopupMenu.PopupMenuItem(_('Settings & Gestures...'));
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(settingsItem);

        // Start in disconnected view until state arrives
        this._connectedSection.actor.visible = false;
        this._disconnectedSection.actor.visible = true;
    }

    _createButton(label, onClick, styleClass = 'nothing-ear-mode-btn') {
        const btn = new St.Button({
            label: label,
            style_class: `button ${styleClass}`,
            x_expand: true,
            can_focus: true,
        });
        btn.connect('clicked', onClick);
        return btn;
    }

    _setANCStrength(strengthValue) {
        if (this._proxy) {
            this._proxy.SetANCStrengthRemote(strengthValue, () => {});
        }
    }

    _setANC(mode) {
        if (this._proxy) {
            this._proxy.SetANCModeRemote(mode, () => {});
        }
    }

    _setEQ(mode) {
        if (this._proxy) {
            this._proxy.SetEQModeRemote(mode, () => {});
        }
    }

    _setEnhancedBass(enabled, level) {
        if (this._proxy) {
            this._proxy.SetEnhancedBassRemote(enabled, level, () => {});
        }
    }

    _toggleRing(side) {
        if (side === 'left') {
            this._isRingingLeft = !this._isRingingLeft;
            if (this._proxy) this._proxy.RingBudsRemote(this._isRingingLeft, 'left', () => {});
            this._ringLeftBtn.set_style_class_name(this._isRingingLeft ? 'button nothing-ear-mode-btn nothing-ear-ring-btn-active' : 'button nothing-ear-mode-btn');
        } else if (side === 'right') {
            this._isRingingRight = !this._isRingingRight;
            if (this._proxy) this._proxy.RingBudsRemote(this._isRingingRight, 'right', () => {});
            this._ringRightBtn.set_style_class_name(this._isRingingRight ? 'button nothing-ear-mode-btn nothing-ear-ring-btn-active' : 'button nothing-ear-mode-btn');
        }
    }

    _stopRing() {
        this._isRingingLeft = false;
        this._isRingingRight = false;
        if (this._proxy) this._proxy.RingBudsRemote(false, 'both', () => {});
        this._ringLeftBtn.set_style_class_name('button nothing-ear-mode-btn');
        this._ringRightBtn.set_style_class_name('button nothing-ear-mode-btn');
    }

    _updateState(state) {
        this._state = state;

        if (!state.connected) {
            this._icon.opacity = 120;
            this._label.hide();
            if (this._connectedSection && this._connectedSection.actor) {
                this._connectedSection.actor.visible = false;
            }
            if (this._disconnectedSection && this._disconnectedSection.actor) {
                this._disconnectedSection.actor.visible = true;
            }
            this._leftBattery.setLevel(-1);
            this._rightBattery.setLevel(-1);
            this._caseBattery.setLevel(-1);
            return;
        }

        if (this._connectedSection && this._connectedSection.actor) {
            this._connectedSection.actor.visible = true;
        }
        if (this._disconnectedSection && this._disconnectedSection.actor) {
            this._disconnectedSection.actor.visible = false;
        }

        this._icon.opacity = 255;
        this._deviceTitleLabel.text = `${state.model_name || 'Nothing Ear'}${state.firmware ? ` (${state.firmware})` : ''}`;

        // Battery updates to circular gauges
        this._leftBattery.setLevel(state.battery_left, state.charging_left);
        this._rightBattery.setLevel(state.battery_right, state.charging_right);
        this._caseBattery.setLevel(state.battery_case, state.charging_case);

        // Hide case gauge if case battery is -1 (not reported/offline)
        this._caseBattery.visible = (state.battery_case >= 0);

        // Top bar label
        const lowestBatt = Math.min(
            state.battery_left >= 0 ? state.battery_left : 100,
            state.battery_right >= 0 ? state.battery_right : 100
        );

        let ancShort = _('Off');
        if (state.anc_mode === 1) ancShort = _('NC');
        else if (state.anc_mode === 2) ancShort = _('NC Mid');
        else if (state.anc_mode === 3) ancShort = _('NC Low');
        else if (state.anc_mode === 4) ancShort = _('Adapt');
        else if (state.anc_mode === 7) ancShort = _('Trans');

        if (lowestBatt < 100) {
            this._label.text = `${lowestBatt}% • ${ancShort}`;
            this._label.show();
        } else {
            this._label.text = ancShort;
            this._label.show();
        }

        // ANC Active states
        const isNC = [1, 2, 3, 4].includes(state.anc_mode);
        this._btnNC.setActive(isNC);
        this._btnTrans.setActive(state.anc_mode === 7);
        this._btnOff.setActive(state.anc_mode === 5);

        // Show/hide ANC strength sub-row
        if (this._ancStrengthMenuItem) {
            this._ancStrengthMenuItem.visible = isNC;
        }
        if (isNC) {
            this._btnHigh.set_style_class_name(state.anc_mode === 1 ? 'button nothing-ear-strength-btn active' : 'button nothing-ear-strength-btn');
            this._btnMid.set_style_class_name(state.anc_mode === 2 ? 'button nothing-ear-strength-btn active' : 'button nothing-ear-strength-btn');
            this._btnLow.set_style_class_name(state.anc_mode === 3 ? 'button nothing-ear-strength-btn active' : 'button nothing-ear-strength-btn');
            this._btnAdapt.set_style_class_name(state.anc_mode === 4 ? 'button nothing-ear-strength-btn active' : 'button nothing-ear-strength-btn');
        }

        // Equalizer Active states
        const eqMode = state.eq_mode || 0;
        this._eqBalanced.set_style_class_name(eqMode === 0 ? 'button nothing-ear-mode-btn active' : 'button nothing-ear-mode-btn');
        this._eqVoice.set_style_class_name(eqMode === 1 ? 'button nothing-ear-mode-btn active' : 'button nothing-ear-mode-btn');
        this._eqTreble.set_style_class_name(eqMode === 2 ? 'button nothing-ear-mode-btn active' : 'button nothing-ear-mode-btn');
        this._eqBass.set_style_class_name(eqMode === 3 ? 'button nothing-ear-mode-btn active' : 'button nothing-ear-mode-btn');
        this._eqCustom.set_style_class_name(eqMode === 4 ? 'button nothing-ear-mode-btn active' : 'button nothing-ear-mode-btn');

        // Enhanced Bass
        const supportsBass = ['B171', 'B172', 'B168', 'B162'].includes(state.model_base);
        if (this._bassSwitch) this._bassSwitch.visible = supportsBass;
        if (this._bassLevelMenuItem) this._bassLevelMenuItem.visible = supportsBass;
        if (supportsBass && state.enhanced_bass) {
            this._bassSwitch.setToggleState(state.enhanced_bass.enabled);
            this._bassLevels.forEach((btn, idx) => {
                const lvl = idx + 1;
                btn.set_style_class_name(
                    (state.enhanced_bass.enabled && state.enhanced_bass.level === lvl)
                        ? 'button nothing-ear-strength-btn active'
                        : 'button nothing-ear-strength-btn'
                );
            });
        }

        // Switches
        this._inEarSwitch.setToggleState(state.in_ear_detection);
        this._latencySwitch.setToggleState(state.low_latency);
    }

    destroy() {
        if (this._proxy && this._signalId) {
            this._proxy.disconnectSignal(this._signalId);
            this._signalId = 0;
        }
        super.destroy();
    }
});

export default class NothingEarExtension extends Extension {
    enable() {
        this._panelButton = new NothingEarPanelButton(this);
        Main.panel.addToStatusArea('nothing-ear-indicator', this._panelButton, 1, 'right');
        this._initDBus();
    }

    _initDBus() {
        try {
            // Connect Proxy
            this._proxy = new NothingEarProxy(
                Gio.DBus.session,
                NOTHING_EAR_DBUS_NAME,
                NOTHING_EAR_DBUS_PATH,
                (proxy, error) => {
                    if (error) {
                        console.error('[NothingEar] Error connecting to NothingEar DBus service:', error);
                        return;
                    }
                    if (this._panelButton) {
                        this._panelButton.setProxy(proxy);
                    }
                }
            );
        } catch (e) {
            console.error('[NothingEar] Exception initializing DBus:', e);
        }
    }

    disable() {
        if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = null;
        }
        this._proxy = null;
    }
}
