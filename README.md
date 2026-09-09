# Nothing & CMF Earbuds GNOME Shell Extension

A fully featured GNOME Shell extension and control center for **Nothing** and **CMF** earbuds, based on reverse-engineered protocols from [`radiance-project/ear-web`](https://github.com/radiance-project/ear-web).

![Nothing Ear GNOME Extension](icons/ear-web.png)

---

## 🎧 Supported Devices

- **Nothing Ear (1)** (`B181`) – White & Black
- **Nothing Ear (stick)** (`B157`)
- **Nothing Ear (2)** (`B155`) – White & Black
- **Nothing Ear** (`B171`) – White & Black
- **Nothing Ear (a)** (`B162`) – Black, White & Yellow
- **Nothing Ear (open)** (`B174`)
- **CMF Buds Pro** (`B163`) – Dark Grey, Light Grey & Orange
- **CMF Buds** (`B168`) – Dark Grey, Light Grey & Orange
- **CMF Buds Pro 2** (`B172`) – Dark Grey, Light Grey, Orange & Blue
- **CMF Neckband Pro** (`B164`)

---

## ✨ Features

- **Quick Settings Integration**:
  - Live earbud & case battery percentage indicators with charging status.
  - Active Noise Cancellation (ANC) mode switching: **Noise Cancellation**, **Transparency**, and **Off**.
  - ANC strength selection: **High**, **Mid**, **Low**, and **Adaptive**.
  - Equalizer Presets: **Balanced**, **More Bass**, **More Treble**, **Voice**, and **Custom**.
  - **Ultra Bass / Enhanced Bass**: 5-level bass enhancement toggle for supported models.
  - **In-Ear Detection**: Auto-pause / resume toggle.
  - **Low Latency Mode**: Toggle for gaming and media audio sync.
  - **Find My Earbuds (Ring)**: Ring Left, Right, or Both earbuds to locate them.
- **Libadwaita Preferences Window** (`prefs.js`):
  - **Device Overview**: Model detection, serial number, firmware version, and battery bars.
  - **Gestures Configuration**: Custom action mapping per earbud (Double tap/pinch, Triple tap/pinch, Tap/pinch & hold, Double tap/pinch & hold).
  - **3-Band Custom Equalizer**: Real-time Bass, Mid, and Treble float sliders (-6 dB to +6 dB).
  - **Ear Tip Fit Test**: Run live acoustic seal seal test with visual pass/fail indicator.
  - **Case LED Colors**: Custom RGB picker for Nothing Ear (1) case LEDs.
- **Robust Background Service** (`backend.py`):
  - Zero-lag asynchronous communication over Bluetooth RFCOMM / SPP.
  - BlueZ integration with automatic connection detection and reconnection.
  - D-Bus interface `org.gnome.NothingEar` on the Session Bus.

---

## 🚀 Installation

### 1. Requirements

- GNOME Shell 45, 46, 47, 48, 49, or 50
- `bluez` and `python3` (with `python-dbus` / `python-gobject`)

### 2. Quick Install

Run the included installer:

```bash
cd /home/kristof/.gemini/antigravity/scratch/nothing-ear-gnome-extension
./install.sh
```

### 3. Enable Extension

Enable the extension via `gnome-extensions`:

```bash
gnome-extensions enable nothing-ear@radiance.gnome.org
```

*(If on Wayland and installing for the first time, log out and back in to let GNOME Shell load the new extension).*

### 4. Background Service (Optional / Recommended)

The extension automatically manages the backend, but you can also run it via systemd:

```bash
systemctl --user enable --now nothing-ear.service
```

---

## 🛠️ DBus Interface

The backend exposes `org.gnome.NothingEar` at `/org/gnome/NothingEar` on the session bus:

```bash
# Get full JSON state
gdbus call --session --dest org.gnome.NothingEar --object-path /org/gnome/NothingEar --method org.gnome.NothingEar.GetState

# Set ANC to High NC (1), Mid (2), Low (3), Adaptive (4), Off (5), Transparency (7)
gdbus call --session --dest org.gnome.NothingEar --object-path /org/gnome/NothingEar --method org.gnome.NothingEar.SetANCMode 1

# Set Enhanced Bass (Enabled, Level 1-5)
gdbus call --session --dest org.gnome.NothingEar --object-path /org/gnome/NothingEar --method org.gnome.NothingEar.SetEnhancedBass true 4

# Ring Left Bud
gdbus call --session --dest org.gnome.NothingEar --object-path /org/gnome/NothingEar --method org.gnome.NothingEar.RingBuds true "left"
```

---

## 📜 Credits & Acknowledgments

- Based on [`radiance-project/ear-web`](https://github.com/radiance-project/ear-web) by **RapidZapper** and **Bendix**.
- RFCOMM reverse engineering discoveries by **Bharadwaj Raju** and **DaanHessen** (`earctl`).
- Licensed under **GPLv3**.
