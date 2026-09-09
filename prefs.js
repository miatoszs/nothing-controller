/**
 * Nothing & CMF Earbuds Preferences Window
 * Built with Libadwaita (Adw) for GNOME Shell 45+
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const NOTHING_EAR_DBUS_NAME = 'org.gnome.NothingEar';
const NOTHING_EAR_DBUS_PATH = '/org/gnome/NothingEar';

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
    <method name="SetGesture">
      <arg type="i" direction="in" name="device"/>
      <arg type="i" direction="in" name="common"/>
      <arg type="i" direction="in" name="gesture_type"/>
      <arg type="i" direction="in" name="action"/>
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
    <signal name="EarFitResult">
      <arg type="i" name="left_result"/>
      <arg type="i" name="right_result"/>
    </signal>
  </interface>
</node>`;

const NothingEarProxy = Gio.DBusProxy.makeProxyWrapper(NothingEarInterface);

export default class NothingEarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(680, 720);
        const settings = this.getSettings();

        // Connect DBus proxy
        let proxy = null;
        let currentState = null;

        // -------------------------------------------------------------
        // Page 1: Device Overview
        // -------------------------------------------------------------
        const devicePage = new Adw.PreferencesPage({
            title: _('Overview'),
            icon_name: 'audio-headphones-symbolic',
        });
        window.add(devicePage);

        const statusGroup = new Adw.PreferencesGroup({
            title: _('Device Status'),
        });
        devicePage.add(statusGroup);

        const modelRow = new Adw.ActionRow({
            title: _('Model'),
            subtitle: _('Searching for connected earbuds...'),
        });
        statusGroup.add(modelRow);

        const firmwareRow = new Adw.ActionRow({
            title: _('Firmware Version'),
            subtitle: _('--'),
        });
        statusGroup.add(firmwareRow);

        const serialRow = new Adw.ActionRow({
            title: _('Serial Number'),
            subtitle: _('--'),
        });
        statusGroup.add(serialRow);

        const macRow = new Adw.ActionRow({
            title: _('Bluetooth Address'),
            subtitle: _('--'),
        });
        statusGroup.add(macRow);

        // Battery Group
        const batteryGroup = new Adw.PreferencesGroup({
            title: _('Battery Levels'),
        });
        devicePage.add(batteryGroup);

        const leftBattRow = new Adw.ActionRow({
            title: _('Left Earbud'),
            subtitle: _('--'),
        });
        const leftBattBar = new Gtk.ProgressBar({
            valign: Gtk.Align.CENTER,
            fraction: 0.0,
            show_text: true,
        });
        leftBattRow.add_suffix(leftBattBar);
        batteryGroup.add(leftBattRow);

        const rightBattRow = new Adw.ActionRow({
            title: _('Right Earbud'),
            subtitle: _('--'),
        });
        const rightBattBar = new Gtk.ProgressBar({
            valign: Gtk.Align.CENTER,
            fraction: 0.0,
            show_text: true,
        });
        rightBattRow.add_suffix(rightBattBar);
        batteryGroup.add(rightBattRow);

        const caseBattRow = new Adw.ActionRow({
            title: _('Charging Case'),
            subtitle: _('--'),
        });
        const caseBattBar = new Gtk.ProgressBar({
            valign: Gtk.Align.CENTER,
            fraction: 0.0,
            show_text: true,
        });
        caseBattRow.add_suffix(caseBattBar);
        batteryGroup.add(caseBattRow);

        // -------------------------------------------------------------
        // Page 2: Gestures Customization
        // -------------------------------------------------------------
        const gesturesPage = new Adw.PreferencesPage({
            title: _('Gestures'),
            icon_name: 'input-touchpad-symbolic',
        });
        window.add(gesturesPage);

        const sideGroup = new Adw.PreferencesGroup({
            title: _('Select Earbud'),
        });
        gesturesPage.add(sideGroup);

        const sideCombo = new Adw.ComboRow({
            title: _('Earbud'),
            model: new Gtk.StringList({
                strings: [_('Left Earbud'), _('Right Earbud')],
            }),
            selected: 0,
        });
        sideGroup.add(sideCombo);

        const actionsGroup = new Adw.PreferencesGroup({
            title: _('Gestures & Actions'),
        });
        gesturesPage.add(actionsGroup);

        // Double Pinch/Tap
        const doubleActions = [
            _('Play / Pause'),
            _('Skip Forward'),
            _('Skip Back'),
            _('Voice Assistant'),
            _('No Action'),
        ];
        const doubleCodes = [2, 9, 8, 11, 1];

        const doubleRow = new Adw.ComboRow({
            title: _('Double Pinch / Tap'),
            subtitle: _('Decline incoming call (fixed)'),
            model: new Gtk.StringList({ strings: doubleActions }),
        });
        actionsGroup.add(doubleRow);

        // Triple Pinch/Tap
        const tripleActions = [
            _('Skip Back'),
            _('Skip Forward'),
            _('Voice Assistant'),
            _('No Action'),
        ];
        const tripleCodes = [8, 9, 11, 1];

        const tripleRow = new Adw.ComboRow({
            title: _('Triple Pinch / Tap'),
            model: new Gtk.StringList({ strings: tripleActions }),
        });
        actionsGroup.add(tripleRow);

        // Pinch & Hold
        const holdActions = [
            _('Noise Control (ANC)'),
            _('Volume Up'),
            _('Volume Down'),
            _('Voice Assistant'),
            _('No Action'),
        ];
        const holdCodes = [10, 18, 19, 11, 1];

        const holdRow = new Adw.ComboRow({
            title: _('Pinch & Hold / Tap & Hold'),
            model: new Gtk.StringList({ strings: holdActions }),
        });
        actionsGroup.add(holdRow);

        // Double Pinch & Hold
        const doubleHoldActions = [
            _('Noise Control (ANC)'),
            _('Volume Up'),
            _('Volume Down'),
            _('Voice Assistant'),
            _('No Action'),
        ];
        const doubleHoldCodes = [10, 18, 19, 11, 1];

        const doubleHoldRow = new Adw.ComboRow({
            title: _('Double Pinch & Hold'),
            model: new Gtk.StringList({ strings: doubleHoldActions }),
        });
        actionsGroup.add(doubleHoldRow);

        const updateGestureControls = () => {
            if (!currentState || !currentState.gestures) return;
            const device = (sideCombo.selected === 0) ? 2 : 3; // 2=Left, 3=Right

            for (const g of currentState.gestures) {
                if (g.device === device) {
                    if (g.type === 2) {
                        const idx = doubleCodes.indexOf(g.action);
                        if (idx >= 0) doubleRow.selected = idx;
                    } else if (g.type === 3) {
                        const idx = tripleCodes.indexOf(g.action);
                        if (idx >= 0) tripleRow.selected = idx;
                    } else if (g.type === 7) {
                        const idx = holdCodes.indexOf(g.action);
                        if (idx >= 0) holdRow.selected = idx;
                    } else if (g.type === 9) {
                        const idx = doubleHoldCodes.indexOf(g.action);
                        if (idx >= 0) doubleHoldRow.selected = idx;
                    }
                }
            }
        };

        sideCombo.connect('notify::selected', updateGestureControls);

        doubleRow.connect('notify::selected', () => {
            if (!proxy) return;
            const device = (sideCombo.selected === 0) ? 2 : 3;
            const action = doubleCodes[doubleRow.selected];
            proxy.SetGestureRemote(device, 1, 2, action, () => {});
        });

        tripleRow.connect('notify::selected', () => {
            if (!proxy) return;
            const device = (sideCombo.selected === 0) ? 2 : 3;
            const action = tripleCodes[tripleRow.selected];
            proxy.SetGestureRemote(device, 1, 3, action, () => {});
        });

        holdRow.connect('notify::selected', () => {
            if (!proxy) return;
            const device = (sideCombo.selected === 0) ? 2 : 3;
            const action = holdCodes[holdRow.selected];
            proxy.SetGestureRemote(device, 1, 7, action, () => {});
        });

        doubleHoldRow.connect('notify::selected', () => {
            if (!proxy) return;
            const device = (sideCombo.selected === 0) ? 2 : 3;
            const action = doubleHoldCodes[doubleHoldRow.selected];
            proxy.SetGestureRemote(device, 1, 9, action, () => {});
        });

        // -------------------------------------------------------------
        // Page 3: Custom Equalizer
        // -------------------------------------------------------------
        const eqPage = new Adw.PreferencesPage({
            title: _('Equalizer'),
            icon_name: 'audio-volume-high-symbolic',
        });
        window.add(eqPage);

        const eqGroup = new Adw.PreferencesGroup({
            title: _('3-Band Custom Equalizer'),
            description: _('Fine-tune Bass, Mid, and Treble frequencies (-6 dB to +6 dB).'),
        });
        eqPage.add(eqGroup);

        const bassScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({ lower: -6.0, upper: 6.0, step_increment: 0.5, value: 0.0 }),
            digits: 1,
            draw_value: true,
            hexpand: true,
        });
        const bassRow = new Adw.ActionRow({ title: _('Bass') });
        bassRow.add_suffix(bassScale);
        eqGroup.add(bassRow);

        const midScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({ lower: -6.0, upper: 6.0, step_increment: 0.5, value: 0.0 }),
            digits: 1,
            draw_value: true,
            hexpand: true,
        });
        const midRow = new Adw.ActionRow({ title: _('Mid') });
        midRow.add_suffix(midScale);
        eqGroup.add(midRow);

        const trebleScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({ lower: -6.0, upper: 6.0, step_increment: 0.5, value: 0.0 }),
            digits: 1,
            draw_value: true,
            hexpand: true,
        });
        const trebleRow = new Adw.ActionRow({ title: _('Treble') });
        trebleRow.add_suffix(trebleScale);
        eqGroup.add(trebleRow);

        const applyEqBtn = new Gtk.Button({
            label: _('Apply Equalizer'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        applyEqBtn.connect('clicked', () => {
            if (proxy) {
                proxy.SetCustomEQRemote(bassScale.get_value(), midScale.get_value(), trebleScale.get_value(), () => {});
                proxy.SetEQModeRemote(4, () => {}); // Select Custom Preset
            }
        });
        const applyEqRow = new Adw.ActionRow({ title: _('Save Settings') });
        applyEqRow.add_suffix(applyEqBtn);
        eqGroup.add(applyEqRow);

        // -------------------------------------------------------------
        // Page 4: Diagnostics & Tools (Fit Test, Ring)
        // -------------------------------------------------------------
        const toolsPage = new Adw.PreferencesPage({
            title: _('Tools'),
            icon_name: 'emblem-system-symbolic',
        });
        window.add(toolsPage);

        const fitTestGroup = new Adw.PreferencesGroup({
            title: _('Ear Tip Fit Test'),
            description: _('Check the acoustic seal of your ear tips for optimal Noise Cancellation.'),
        });
        toolsPage.add(fitTestGroup);

        const fitTestStatusRow = new Adw.ActionRow({
            title: _('Fit Status'),
            subtitle: _('Place both earbuds in your ears and start the test.'),
        });

        const startFitTestBtn = new Gtk.Button({
            label: _('Start Test'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        startFitTestBtn.connect('clicked', () => {
            if (proxy) {
                fitTestStatusRow.subtitle = _('Running test, keep earbuds in your ears...');
                proxy.StartEarFitTestRemote(() => {});
            }
        });
        fitTestStatusRow.add_suffix(startFitTestBtn);
        fitTestGroup.add(fitTestStatusRow);

        // -------------------------------------------------------------
        // Page 5: Extension Preferences
        // -------------------------------------------------------------
        const extPage = new Adw.PreferencesPage({
            title: _('Settings'),
            icon_name: 'preferences-other-symbolic',
        });
        window.add(extPage);

        const extGroup = new Adw.PreferencesGroup({
            title: _('Display & Notifications'),
        });
        extPage.add(extGroup);

        const panelBattSwitch = new Adw.SwitchRow({
            title: _('Show Battery in Top Panel'),
            subtitle: _('Show earbud battery percentage next to the top bar icon.'),
        });
        settings.bind('show-battery-in-panel', panelBattSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        extGroup.add(panelBattSwitch);

        const panelAncSwitch = new Adw.SwitchRow({
            title: _('Show ANC Mode in Quick Settings'),
            subtitle: _('Display the active ANC mode in the quick toggle button.'),
        });
        settings.bind('show-anc-in-panel', panelAncSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        extGroup.add(panelAncSwitch);

        const notifSwitch = new Adw.SwitchRow({
            title: _('Low Battery Notifications'),
            subtitle: _('Notify when earbud battery drops below 20%.'),
        });
        settings.bind('enable-battery-notifications', notifSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        extGroup.add(notifSwitch);

        // Update UI from state
        const updateUI = (state) => {
            currentState = state;
            if (!state.connected) {
                modelRow.subtitle = _('Disconnected (Connect Bluetooth)');
                firmwareRow.subtitle = '--';
                serialRow.subtitle = '--';
                macRow.subtitle = '--';
                leftBattRow.subtitle = '--';
                leftBattBar.set_fraction(0.0);
                rightBattRow.subtitle = '--';
                rightBattBar.set_fraction(0.0);
                caseBattRow.subtitle = '--';
                caseBattBar.set_fraction(0.0);
                return;
            }

            modelRow.subtitle = `${state.model_name || 'Nothing Ear'} (${state.model_base})`;
            firmwareRow.subtitle = state.firmware || '--';
            serialRow.subtitle = state.serial || '--';
            macRow.subtitle = state.device_address || '--';

            if (state.battery_left >= 0) {
                leftBattRow.subtitle = `${state.battery_left}%${state.charging_left ? ' ⚡ (Charging)' : ''}`;
                leftBattBar.set_fraction(state.battery_left / 100.0);
            }
            if (state.battery_right >= 0) {
                rightBattRow.subtitle = `${state.battery_right}%${state.charging_right ? ' ⚡ (Charging)' : ''}`;
                rightBattBar.set_fraction(state.battery_right / 100.0);
            }
            if (state.battery_case >= 0) {
                caseBattRow.subtitle = `${state.battery_case}%${state.charging_case ? ' ⚡ (Charging)' : ''}`;
                caseBattBar.set_fraction(state.battery_case / 100.0);
            }

            if (state.custom_eq) {
                bassScale.set_value(state.custom_eq.bass || 0.0);
                midScale.set_value(state.custom_eq.mid || 0.0);
                trebleScale.set_value(state.custom_eq.treble || 0.0);
            }

            updateGestureControls();
        };

        // Initialize Proxy
        proxy = new NothingEarProxy(
            Gio.DBus.session,
            NOTHING_EAR_DBUS_NAME,
            NOTHING_EAR_DBUS_PATH,
            (p, error) => {
                if (error) {
                    console.error('[NothingEar Prefs] Error connecting to DBus:', error);
                    return;
                }

                p.connectSignal('StateChanged', (prx, sender, [stateJson]) => {
                    try {
                        const state = JSON.parse(stateJson);
                        updateUI(state);
                    } catch (e) {}
                });

                p.connectSignal('EarFitResult', (prx, sender, [leftRes, rightRes]) => {
                    const statusStr = (res) => (res === 0 ? _('Good Seal (Perfect)') : _('Adjust Earbud / Try Another Tip'));
                    fitTestStatusRow.subtitle = `Left: ${statusStr(leftRes)} | Right: ${statusStr(rightRes)}`;
                });

                p.GetStateRemote((result, err) => {
                    if (!err && result && result[0]) {
                        try {
                            const state = JSON.parse(result[0]);
                            updateUI(state);
                        } catch (e) {}
                    }
                });
            }
        );
    }
}
