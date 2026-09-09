#!/usr/bin/env python3
"""
Nothing & CMF Earbuds Linux Background Daemon
Exposes D-Bus interface org.gnome.NothingEar on the Session Bus.
Communicates with Nothing & CMF devices over Bluetooth RFCOMM (SPP).
Based on the radiance-project/ear-web protocol.
"""

import sys
import os
import time
import json
import struct
import socket
import select
import threading
import logging
import dbus
import dbus.service
import dbus.mainloop.glib
from gi.repository import GLib

logging.basicConfig(
    level=logging.INFO,
    format='[NothingEar %(levelname)s] %(message)s'
)
logger = logging.getLogger('NothingEarBackend')

# Model database mapped from ear-web
MODEL_DATABASE = {
    # SKU to Model info
    "01": {"id": "ear_1_white", "name": "Nothing Ear (1)", "base": "B181", "anc": True},
    "02": {"id": "ear_1_black", "name": "Nothing Ear (1)", "base": "B181", "anc": True},
    "03": {"id": "ear_1_white", "name": "Nothing Ear (1)", "base": "B181", "anc": True},
    "04": {"id": "ear_1_black", "name": "Nothing Ear (1)", "base": "B181", "anc": True},
    "06": {"id": "ear_1_black", "name": "Nothing Ear (1)", "base": "B181", "anc": True},
    "07": {"id": "ear_1_white", "name": "Nothing Ear (1)", "base": "B181", "anc": True},
    "08": {"id": "ear_1_black", "name": "Nothing Ear (1)", "base": "B181", "anc": True},
    "10": {"id": "ear_1_black", "name": "Nothing Ear (1)", "base": "B181", "anc": True},
    "14": {"id": "ear_stick", "name": "Nothing Ear (stick)", "base": "B157", "anc": False},
    "15": {"id": "ear_stick", "name": "Nothing Ear (stick)", "base": "B157", "anc": False},
    "16": {"id": "ear_stick", "name": "Nothing Ear (stick)", "base": "B157", "anc": False},
    "17": {"id": "ear_2_white", "name": "Nothing Ear (2)", "base": "B155", "anc": True},
    "18": {"id": "ear_2_white", "name": "Nothing Ear (2)", "base": "B155", "anc": True},
    "19": {"id": "ear_2_white", "name": "Nothing Ear (2)", "base": "B155", "anc": True},
    "27": {"id": "ear_2_black", "name": "Nothing Ear (2)", "base": "B155", "anc": True},
    "28": {"id": "ear_2_black", "name": "Nothing Ear (2)", "base": "B155", "anc": True},
    "29": {"id": "ear_2_black", "name": "Nothing Ear (2)", "base": "B155", "anc": True},
    "30": {"id": "corsola_black", "name": "CMF Buds Pro", "base": "B163", "anc": True},
    "31": {"id": "corsola_black", "name": "CMF Buds Pro", "base": "B163", "anc": True},
    "32": {"id": "corsola_white", "name": "CMF Buds Pro", "base": "B163", "anc": True},
    "33": {"id": "corsola_white", "name": "CMF Buds Pro", "base": "B163", "anc": True},
    "34": {"id": "corsola_orange", "name": "CMF Buds Pro", "base": "B163", "anc": True},
    "35": {"id": "corsola_orange", "name": "CMF Buds Pro", "base": "B163", "anc": True},
    "48": {"id": "crobat_orange", "name": "CMF Neckband Pro", "base": "B164", "anc": True},
    "49": {"id": "crobat_white", "name": "CMF Neckband Pro", "base": "B164", "anc": True},
    "50": {"id": "crobat_black", "name": "CMF Neckband Pro", "base": "B164", "anc": True},
    "51": {"id": "crobat_black", "name": "CMF Neckband Pro", "base": "B164", "anc": True},
    "52": {"id": "crobat_white", "name": "CMF Neckband Pro", "base": "B164", "anc": True},
    "53": {"id": "crobat_orange", "name": "CMF Neckband Pro", "base": "B164", "anc": True},
    "54": {"id": "donphan_black", "name": "CMF Buds", "base": "B168", "anc": True},
    "55": {"id": "donphan_black", "name": "CMF Buds", "base": "B168", "anc": True},
    "56": {"id": "donphan_white", "name": "CMF Buds", "base": "B168", "anc": True},
    "57": {"id": "donphan_white", "name": "CMF Buds", "base": "B168", "anc": True},
    "58": {"id": "donphan_orange", "name": "CMF Buds", "base": "B168", "anc": True},
    "59": {"id": "donphan_orange", "name": "CMF Buds", "base": "B168", "anc": True},
    "61": {"id": "entei_black", "name": "Nothing Ear", "base": "B171", "anc": True},
    "62": {"id": "entei_white", "name": "Nothing Ear", "base": "B171", "anc": True},
    "63": {"id": "cleffa_black", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "64": {"id": "cleffa_white", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "65": {"id": "cleffa_yellow", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "66": {"id": "cleffa_black", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "67": {"id": "cleffa_white", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "68": {"id": "cleffa_yellow", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "69": {"id": "entei_black", "name": "Nothing Ear", "base": "B171", "anc": True},
    "70": {"id": "entei_white", "name": "Nothing Ear", "base": "B171", "anc": True},
    "71": {"id": "cleffa_black", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "72": {"id": "cleffa_white", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "73": {"id": "cleffa_yellow", "name": "Nothing Ear (a)", "base": "B162", "anc": True},
    "74": {"id": "entei_black", "name": "Nothing Ear", "base": "B171", "anc": True},
    "75": {"id": "entei_white", "name": "Nothing Ear", "base": "B171", "anc": True},
    "76": {"id": "espeon_black", "name": "CMF Buds Pro 2", "base": "B172", "anc": True},
    "77": {"id": "espeon_white", "name": "CMF Buds Pro 2", "base": "B172", "anc": True},
    "78": {"id": "espeon_orange", "name": "CMF Buds Pro 2", "base": "B172", "anc": True},
    "79": {"id": "espeon_blue", "name": "CMF Buds Pro 2", "base": "B172", "anc": True},
    "80": {"id": "espeon_blue", "name": "CMF Buds Pro 2", "base": "B172", "anc": True},
    "81": {"id": "espeon_orange", "name": "CMF Buds Pro 2", "base": "B172", "anc": True},
    "82": {"id": "espeon_white", "name": "CMF Buds Pro 2", "base": "B172", "anc": True},
    "83": {"id": "espeon_black", "name": "CMF Buds Pro 2", "base": "B172", "anc": True},
    "11200005": {"id": "flaaffy_white", "name": "Nothing Ear (open)", "base": "B174", "anc": False},
}

KNOWN_UUIDS = [
    "aeac4a03-dff5-498f-843a-34487cf133eb", # Nothing SPP UUID
    "df21fe2c-2515-4fdb-8886-f12c4d67927c", # FastPair UUID
]

def crc16(buf: bytes) -> int:
    crc = 0xFFFF
    for b in buf:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if (crc & 1) else (crc >> 1)
    return crc

def encode_eq_float(f: float, is_total: bool = False) -> bytes:
    if is_total and f >= 0.0:
        return bytes([0x00, 0x00, 0x00, 0x80])
    b = bytearray(struct.pack('>f', f))
    if f != 0.0 and b[0] == 0 and b[1] == 0 and b[2] == 0:
        b[3] |= 0x80
    b.reverse()
    return bytes(b)

def decode_eq_float(buf: bytes) -> float:
    if len(buf) < 4:
        return 0.0
    b = bytearray(buf[:4])
    b.reverse()
    if b[0] == 0 and b[1] == 0 and b[2] == 0 and (b[3] & 0x80):
        b[3] &= 0x7F
        f = struct.unpack('>f', bytes(b))[0]
        return -f
    return struct.unpack('>f', bytes(b))[0]

class EarbudsController:
    def __init__(self, on_state_changed_cb=None, on_ear_fit_cb=None):
        self.on_state_changed_cb = on_state_changed_cb
        self.on_ear_fit_cb = on_ear_fit_cb
        self.sock = None
        self.lock = threading.Lock()
        self.op_id = 1
        self.device_addr = None
        self.device_name = "Nothing Ear"
        self.rfcomm_channel = 15
        
        self.state = {
            "connected": False,
            "device_address": "",
            "device_name": "",
            "model_id": "unknown",
            "model_name": "Nothing Earbuds",
            "model_base": "UNKNOWN",
            "sku": "",
            "serial": "",
            "firmware": "",
            "anc_capable": True,
            "battery_left": -1,
            "battery_right": -1,
            "battery_case": -1,
            "charging_left": False,
            "charging_right": False,
            "charging_case": False,
            "anc_mode": 5, # 1: High, 2: Mid, 3: Low, 4: Adaptive, 5: Off, 7: Transparency
            "anc_strength": 0, # 0: High, 1: Low, 2: Mid, 3: Adaptive
            "eq_mode": 0, # 0: Balanced, 1: Voice, 2: More Treble, 3: More Bass, 4: Custom
            "custom_eq": {"bass": 0.0, "mid": 0.0, "treble": 0.0},
            "enhanced_bass": {"enabled": False, "level": 1},
            "in_ear_detection": True,
            "low_latency": False,
            "personalized_anc": False,
            "gestures": [],
            "led_case_colors": []
        }
        self.running = True
        self.worker_thread = threading.Thread(target=self._connection_loop, daemon=True)
        self.worker_thread.start()

    def _notify_state(self):
        if self.on_state_changed_cb:
            try:
                GLib.idle_add(self.on_state_changed_cb, json.dumps(self.state))
            except Exception as e:
                logger.error(f"Error notifying state: {e}")

    def _next_op_id(self) -> int:
        self.op_id = (self.op_id + 1) if self.op_id < 250 else 1
        return self.op_id

    def _make_packet(self, cmd: int, payload: bytes = b'') -> bytes:
        op = self._next_op_id()
        hdr = bytearray([0x55, 0x60, 0x01])
        hdr += struct.pack('<H', cmd)
        hdr.append(len(payload))
        hdr.append(0x00)
        hdr.append(op)
        hdr += payload
        crc = crc16(hdr)
        return bytes(hdr + struct.pack('<H', crc))

    def _send_raw(self, cmd: int, payload: bytes = b''):
        if not self.sock:
            return False
        try:
            pkt = self._make_packet(cmd, payload)
            self.sock.sendall(pkt)
            return True
        except Exception as e:
            logger.error(f"Error sending command 0x{cmd:04x}: {e}")
            self._disconnect_socket()
            return False

    def _disconnect_socket(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None
        if self.state["connected"]:
            self.state["connected"] = False
            self.state["battery_left"] = -1
            self.state["battery_right"] = -1
            self.state["battery_case"] = -1
            logger.info("Earbuds disconnected")
            self._notify_state()

    def find_connected_device(self):
        try:
            bus = dbus.SystemBus()
            om = dbus.Interface(bus.get_object('org.bluez', '/'), 'org.freedesktop.DBus.ObjectManager')
            objects = om.GetManagedObjects()
            for path, interfaces in objects.items():
                if 'org.bluez.Device1' in interfaces:
                    props = interfaces['org.bluez.Device1']
                    connected = bool(props.get('Connected', False))
                    name = str(props.get('Name', props.get('Alias', '')))
                    uuids = [str(u).lower() for u in props.get('UUIDs', [])]
                    addr = str(props.get('Address', ''))
                    
                    # Check if device is connected and is a Nothing/CMF earbud
                    is_target = any(u in uuids for u in KNOWN_UUIDS) or \
                                "nothing" in name.lower() or \
                                "cmf" in name.lower() or \
                                "ear (" in name.lower() or \
                                "ear (" in name.lower()
                    
                    if connected and is_target:
                        return addr, name
        except Exception as e:
            logger.error(f"Error looking for bluetooth devices: {e}")
        return None, None

    def connect_to_device(self, addr, name):
        channels_to_try = [15, 3, 1, 2, 4, 5, 6, 7, 8]
        for ch in channels_to_try:
            try:
                s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
                s.settimeout(2.5)
                s.connect((addr, ch))
                s.setblocking(False)
                self.sock = s
                self.device_addr = addr
                self.device_name = name
                self.rfcomm_channel = ch
                self.state["connected"] = True
                self.state["device_address"] = addr
                self.state["device_name"] = name
                logger.info(f"Connected successfully to {name} ({addr}) on RFCOMM channel {ch}!")
                self._query_all_initial()
                return True
            except Exception as e:
                # logger.debug(f"Channel {ch} connect failed: {e}")
                pass
        return False

    def _query_all_initial(self):
        # 1. Serial info (to detect SKU / model base)
        self._send_raw(0xC006)
        time.sleep(0.08)
        # 2. Battery
        self._send_raw(0xC007)
        time.sleep(0.08)
        # 3. ANC
        self._send_raw(0xC01E)
        time.sleep(0.08)
        # 4. EQ
        self._send_raw(0xC01F)
        time.sleep(0.08)
        # 5. Firmware
        self._send_raw(0xC042)
        time.sleep(0.08)
        # 6. In-Ear
        self._send_raw(0xC00E)
        time.sleep(0.08)
        # 7. Latency
        self._send_raw(0xC041)
        time.sleep(0.08)
        # 8. Gestures
        self._send_raw(0xC018)
        time.sleep(0.08)
        # 9. Enhanced Bass
        self._send_raw(0xC04E)
        time.sleep(0.08)
        # 10. Personalized ANC
        self._send_raw(0xC020)
        time.sleep(0.08)
        # 11. Custom EQ
        self._send_raw(0xC044)
        self._notify_state()

    def _connection_loop(self):
        rx_buffer = bytearray()
        poll_timer = 0

        while self.running:
            try:
                if not self.sock:
                    addr, name = self.find_connected_device()
                    if addr:
                        self.connect_to_device(addr, name)
                    time.sleep(2.0)
                    continue

                # Read available data with select
                r, _, _ = select.select([self.sock], [], [], 0.5)
                if r:
                    try:
                        chunk = self.sock.recv(1024)
                        if not chunk:
                            logger.info("Socket EOF received")
                            self._disconnect_socket()
                            continue
                        rx_buffer += chunk
                        self._process_rx_buffer(rx_buffer)
                    except BlockingIOError:
                        pass
                    except Exception as e:
                        logger.error(f"Socket read error: {e}")
                        self._disconnect_socket()
                        continue

                # Periodic polling of battery & ANC every 5 seconds
                poll_timer += 0.5
                if poll_timer >= 5.0:
                    poll_timer = 0
                    if self.sock:
                        self._send_raw(0xC007) # Battery
                        time.sleep(0.05)
                        self._send_raw(0xC01E) # ANC

            except Exception as e:
                logger.error(f"Error in connection loop: {e}")
                time.sleep(1.0)

    def _process_rx_buffer(self, rx_buffer: bytearray):
        while len(rx_buffer) >= 10:
            if rx_buffer[0] != 0x55 or rx_buffer[1] != 0x60 or rx_buffer[2] != 0x01:
                # Discard until header magic 0x55
                idx = rx_buffer.find(b'\x55\x60\x01')
                if idx != -1:
                    del rx_buffer[:idx]
                else:
                    rx_buffer.clear()
                    break
                if len(rx_buffer) < 10:
                    break

            cmd = struct.unpack('<H', rx_buffer[3:5])[0]
            payload_len = rx_buffer[5]
            total_len = 8 + payload_len + 2 # Header(8) + Payload + CRC(2)

            if len(rx_buffer) < total_len:
                break

            packet = bytes(rx_buffer[:total_len])
            del rx_buffer[:total_len]

            # Validate CRC
            expected_crc = struct.unpack('<H', packet[-2:])[0]
            actual_crc = crc16(packet[:-2])
            if expected_crc != actual_crc:
                logger.warning(f"CRC mismatch for cmd 0x{cmd:04x}")
                continue

            payload = packet[8:-2]
            self._handle_response_packet(cmd, payload)

    def _handle_response_packet(self, cmd: int, payload: bytes):
        state_changed = False

        # Serial Number / Model Identification (0x4006 / 16390)
        if cmd == 0x4006 or cmd == 0xC006:
            text = payload[7:].decode('utf-8', errors='ignore') if len(payload) >= 8 else payload.decode('utf-8', errors='ignore')
            serial = ""
            for line in text.split('\n'):
                parts = [p.strip() for p in line.split(',')]
                if len(parts) >= 3 and parts[1] == '4' and parts[2]:
                    serial = parts[2]
                    break
            
            if serial:
                self.state["serial"] = serial
                sku = None
                if serial == "12345678901234567":
                    sku = "01"
                elif len(serial) >= 6:
                    if serial.startswith("MA"):
                        year = serial[6:8]
                        sku = "14" if year in ["22", "23"] else "11200005"
                    elif serial.startswith("SH") or serial.startswith("13"):
                        sku = serial[4:6]
                
                if sku and sku in MODEL_DATABASE:
                    info = MODEL_DATABASE[sku]
                    self.state["sku"] = sku
                    self.state["model_id"] = info["id"]
                    self.state["model_name"] = info["name"]
                    self.state["model_base"] = info["base"]
                    self.state["anc_capable"] = info["anc"]
                logger.info(f"Identified Model: {self.state['model_name']} ({self.state['model_base']}), Serial: {serial}")
                state_changed = True

        # Battery Status (0xE001 / 57345 or 0x4007 / 16391)
        elif cmd in (0xE001, 0x4007, 0xC007):
            if len(payload) >= 3:
                count = payload[0]
                for i in range(count):
                    idx = 1 + i * 2
                    if idx + 1 < len(payload):
                        dev_id = payload[idx]
                        level_byte = payload[idx + 1]
                        percent = level_byte & 0x7F
                        charging = bool(level_byte & 0x80)
                        if dev_id == 0x02: # Left
                            self.state["battery_left"] = percent
                            self.state["charging_left"] = charging
                        elif dev_id == 0x03: # Right
                            self.state["battery_right"] = percent
                            self.state["charging_right"] = charging
                        elif dev_id == 0x04: # Case
                            self.state["battery_case"] = percent
                            self.state["charging_case"] = charging
                state_changed = True

        # Active Noise Cancellation (ANC) (0xE003 / 57347 or 0x401E / 16414)
        elif cmd in (0xE003, 0x401E, 0xC01E):
            if len(payload) >= 2:
                anc_raw = payload[1]
                # 0x05=Off, 0x07=Transparency, 0x03=NC Low, 0x01=NC High, 0x02=NC Mid, 0x04=NC Adaptive
                self.state["anc_mode"] = anc_raw
                if anc_raw == 0x01:
                    self.state["anc_strength"] = 0 # High
                elif anc_raw == 0x03:
                    self.state["anc_strength"] = 1 # Low
                elif anc_raw == 0x02:
                    self.state["anc_strength"] = 2 # Mid
                elif anc_raw == 0x04:
                    self.state["anc_strength"] = 3 # Adaptive
                state_changed = True

        # Equalizer Mode (0x401F / 16415 or 0x4050 / 16464)
        elif cmd in (0x401F, 0x4050, 0xC01F, 0xC050):
            if len(payload) >= 1:
                self.state["eq_mode"] = payload[0]
                state_changed = True

        # Custom Equalizer (0x4044 / 16452)
        elif cmd in (0x4044, 0xC044):
            if len(payload) >= 45:
                levels = []
                for band in range(3):
                    offset = 6 + band * 13
                    if offset + 4 <= len(payload):
                        levels.append(decode_eq_float(payload[offset:offset+4]))
                if len(levels) == 3:
                    self.state["custom_eq"] = {
                        "mid": levels[0],
                        "treble": levels[1],
                        "bass": levels[2]
                    }
                    state_changed = True

        # Enhanced Bass / Bass Boost (0x404E / 16462)
        elif cmd in (0x404E, 0xC04E):
            if len(payload) >= 2:
                enabled = bool(payload[0])
                level = max(1, payload[1] // 2)
                self.state["enhanced_bass"] = {"enabled": enabled, "level": level}
                state_changed = True

        # In-Ear Detection (0x400E / 16398)
        elif cmd in (0x400E, 0xC00E):
            if len(payload) >= 3:
                self.state["in_ear_detection"] = bool(payload[2])
                state_changed = True

        # Low Latency Mode (0x4041 / 16449)
        elif cmd in (0x4041, 0xC041):
            if len(payload) >= 1:
                self.state["low_latency"] = (payload[0] == 0x01)
                state_changed = True

        # Personalized ANC (0x4020 / 16416)
        elif cmd in (0x4020, 0xC020):
            if len(payload) >= 1:
                self.state["personalized_anc"] = bool(payload[0])
                state_changed = True

        # Firmware Version (0x4042 / 16450)
        elif cmd in (0x4042, 0xC042):
            self.state["firmware"] = payload.decode('utf-8', errors='ignore').strip()
            state_changed = True

        # Gestures (0x4018 / 16408)
        elif cmd in (0x4018, 0xC018):
            if len(payload) >= 1:
                count = payload[0]
                gestures = []
                for i in range(count):
                    base = 1 + i * 4
                    if base + 3 < len(payload):
                        gestures.append({
                            "device": payload[base],       # 2: Left, 3: Right
                            "common": payload[base + 1],   # 1
                            "type": payload[base + 2],     # 2: Double, 3: Triple, 7: Hold, 9: Double Hold
                            "action": payload[base + 3]    # Action code
                        })
                self.state["gestures"] = gestures
                state_changed = True

        # Ear Fit Test Result (0xE00D / 57357)
        elif cmd == 0xE00D:
            if len(payload) >= 2:
                left_res = payload[0]
                right_res = payload[1]
                if self.on_ear_fit_cb:
                    GLib.idle_add(self.on_ear_fit_cb, left_res, right_res)

        if state_changed:
            self._notify_state()

    # --- Public Control Methods ---

    def set_anc(self, mode: int):
        # mode: 1 (High), 2 (Mid), 3 (Low), 4 (Adaptive), 5 (Off), 7 (Transparency)
        if self._send_raw(0xF00F, bytes([0x01, mode, 0x00])):
            self.state["anc_mode"] = mode
            self._notify_state()
            return True
        return False

    def set_eq_mode(self, mode: int):
        # mode: 0 (Balanced), 1 (More Bass), 2 (More Treble), 3 (Voice), 4 (Custom)
        cmd = 0xF01D if self.state["model_base"] in ["B168", "B172"] else 0xF010
        if self._send_raw(cmd, bytes([mode, 0x00])):
            self.state["eq_mode"] = mode
            self._notify_state()
            return True
        return False

    def set_custom_eq(self, bass: float, mid: float, treble: float):
        payload = bytearray([
            0x03, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x75, 0x44, 0xc3,
            0xf5, 0x28, 0x3f, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0x5a, 0x45, 0x00, 0x00, 0x80,
            0x3f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x43, 0xcd, 0xcc, 0x4c, 0x3f, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ])
        values = [mid, treble, bass]
        highest = max([abs(v) for v in values])
        tot_bytes = encode_eq_float(-highest, True)
        payload[1:5] = tot_bytes
        for i, v in enumerate(values):
            b = encode_eq_float(v, False)
            offset = 6 + i * 13
            payload[offset:offset+4] = b

        if self._send_raw(0xF041, bytes(payload)):
            self.state["custom_eq"] = {"bass": bass, "mid": mid, "treble": treble}
            self._notify_state()
            return True
        return False

    def set_enhanced_bass(self, enabled: bool, level: int):
        en_byte = 0x01 if enabled else 0x00
        lvl_byte = max(1, min(5, level)) * 2
        if self._send_raw(0xF051, bytes([en_byte, lvl_byte])):
            self.state["enhanced_bass"] = {"enabled": enabled, "level": level}
            self._notify_state()
            return True
        return False

    def set_in_ear_detection(self, enabled: bool):
        val = 0x01 if enabled else 0x00
        if self._send_raw(0xF004, bytes([0x01, 0x01, val])):
            self.state["in_ear_detection"] = enabled
            self._notify_state()
            return True
        return False

    def set_low_latency(self, enabled: bool):
        val = bytes([0x01, 0x00]) if enabled else bytes([0x02, 0x00])
        if self._send_raw(0xF040, val):
            self.state["low_latency"] = enabled
            self._notify_state()
            return True
        return False

    def set_personalized_anc(self, enabled: bool):
        val = 0x01 if enabled else 0x00
        if self._send_raw(0xF011, bytes([val])):
            self.state["personalized_anc"] = enabled
            self._notify_state()
            return True
        return False

    def ring_buds(self, enable: bool, side: str = "both"):
        # side: "left", "right", "both"
        if self.state["model_base"] == "B181":
            payload = bytes([0x01 if enable else 0x00])
        else:
            dev_byte = 0x02 if side == "left" else 0x03
            payload = bytes([dev_byte, 0x01 if enable else 0x00])
        return self._send_raw(0xF002, payload)

    def start_ear_fit_test(self):
        return self._send_raw(0xF014, bytes([0x01]))

    def set_gesture(self, device: int, common: int, gesture_type: int, action: int):
        payload = bytes([0x01, device, common, gesture_type, action])
        if self._send_raw(0xF003, payload):
            # Update local gesture table
            for g in self.state["gestures"]:
                if g["device"] == device and g["type"] == gesture_type:
                    g["action"] = action
            self._notify_state()
            return True
        return False

    def set_case_led_colors(self, colors: list):
        # colors: list of [R, G, B]
        payload = bytearray([len(colors)])
        for i, rgb in enumerate(colors):
            payload.append(i + 1)
            payload.extend(rgb)
        return self._send_raw(0xF00D, bytes(payload))

    def refresh(self):
        if self.sock:
            self._query_all_initial()
            return True
        return False


class NothingEarDBusService(dbus.service.Object):
    DBUS_SERVICE_NAME = "org.gnome.NothingEar"
    DBUS_OBJECT_PATH = "/org/gnome/NothingEar"
    DBUS_INTERFACE = "org.gnome.NothingEar"

    def __init__(self, bus):
        super().__init__(bus, self.DBUS_OBJECT_PATH)
        self.controller = EarbudsController(
            on_state_changed_cb=self.StateChanged,
            on_ear_fit_cb=self.EarFitResult
        )

    # --- DBus Signals ---

    @dbus.service.signal(DBUS_INTERFACE, signature='s')
    def StateChanged(self, state_json):
        pass

    @dbus.service.signal(DBUS_INTERFACE, signature='ii')
    def EarFitResult(self, left_result, right_result):
        pass

    # --- DBus Methods ---

    @dbus.service.method(DBUS_INTERFACE, in_signature='', out_signature='s')
    def GetState(self):
        return json.dumps(self.controller.state)

    @dbus.service.method(DBUS_INTERFACE, in_signature='i', out_signature='b')
    def SetANCMode(self, mode):
        return self.controller.set_anc(int(mode))

    @dbus.service.method(DBUS_INTERFACE, in_signature='i', out_signature='b')
    def SetANCStrength(self, strength):
        # strength: 0 (High -> 0x01), 1 (Low -> 0x03), 2 (Mid -> 0x02), 3 (Adaptive -> 0x04)
        mode_map = {0: 0x01, 1: 0x03, 2: 0x02, 3: 0x04}
        mode = mode_map.get(int(strength), 0x01)
        return self.controller.set_anc(mode)

    @dbus.service.method(DBUS_INTERFACE, in_signature='i', out_signature='b')
    def SetEQMode(self, mode):
        return self.controller.set_eq_mode(int(mode))

    @dbus.service.method(DBUS_INTERFACE, in_signature='ddd', out_signature='b')
    def SetCustomEQ(self, bass, mid, treble):
        return self.controller.set_custom_eq(float(bass), float(mid), float(treble))

    @dbus.service.method(DBUS_INTERFACE, in_signature='bi', out_signature='b')
    def SetEnhancedBass(self, enabled, level):
        return self.controller.set_enhanced_bass(bool(enabled), int(level))

    @dbus.service.method(DBUS_INTERFACE, in_signature='b', out_signature='b')
    def SetInEarDetection(self, enabled):
        return self.controller.set_in_ear_detection(bool(enabled))

    @dbus.service.method(DBUS_INTERFACE, in_signature='b', out_signature='b')
    def SetLowLatency(self, enabled):
        return self.controller.set_low_latency(bool(enabled))

    @dbus.service.method(DBUS_INTERFACE, in_signature='b', out_signature='b')
    def SetPersonalizedANC(self, enabled):
        return self.controller.set_personalized_anc(bool(enabled))

    @dbus.service.method(DBUS_INTERFACE, in_signature='bs', out_signature='b')
    def RingBuds(self, enable, side):
        return self.controller.ring_buds(bool(enable), str(side))

    @dbus.service.method(DBUS_INTERFACE, in_signature='', out_signature='b')
    def StartEarFitTest(self):
        return self.controller.start_ear_fit_test()

    @dbus.service.method(DBUS_INTERFACE, in_signature='iiii', out_signature='b')
    def SetGesture(self, device, common, gesture_type, action):
        return self.controller.set_gesture(int(device), int(common), int(gesture_type), int(action))

    @dbus.service.method(DBUS_INTERFACE, in_signature='s', out_signature='b')
    def SetCaseLedColors(self, json_colors):
        colors = json.loads(json_colors)
        return self.controller.set_case_led_colors(colors)

    @dbus.service.method(DBUS_INTERFACE, in_signature='', out_signature='b')
    def Refresh(self):
        return self.controller.refresh()

    @dbus.service.method(DBUS_INTERFACE, in_signature='', out_signature='b')
    def Reconnect(self):
        self.controller._disconnect_socket()
        return True


def main():
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SessionBus()
    try:
        name = dbus.service.BusName(NothingEarDBusService.DBUS_SERVICE_NAME, bus, do_not_queue=True)
    except Exception as e:
        logger.info(f"Nothing Ear daemon is already running: {e}. Exiting.")
        sys.exit(0)

    service = NothingEarDBusService(bus)
    logger.info("Nothing Ear D-Bus daemon is running on session bus.")

    loop = GLib.MainLoop()
    try:
        loop.run()
    except KeyboardInterrupt:
        logger.info("Exiting...")
        service.controller.running = False

if __name__ == '__main__':
    main()
