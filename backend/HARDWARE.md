# Hardware & Electrical Schematic: Room Controller Design

As per the Senior Systems Engineer instructions, this document provides the complete wiring layout, pin-mapping table, connection list, and electrical reasoning required to construct a representative circuit for one room (controlling 2 fans and 3 lights, with current sensing) in Wokwi or Tinkercad.

---

## 1. System Architecture (Hardware Perspective)

For each room, an **ESP32 Microcontroller** is used as the edge node. It acts as both the controller (driving relays to switch the devices) and the sensor (reading current draw).

```
                    ┌─────────────────────────┐
                    │      ESP32 Wi-Fi        │
                    │    (Microcontroller)    │
                    └─────────────────────────┘
                       │                   │
      (GPIO Outputs)   ▼                   ▼   (Analog Input ADC)
               ┌───────────────┐   ┌────────────────────────┐
               │ 5-Ch Relay    │   │  ACS712 (5A/20A)       │
               │ Module (5V)   │   │  Current Sensor        │
               └───────────────┘   └────────────────────────┘
                       │                        │
                       ▼ (Switching)            ▼ (Sensing AC Line)
               [ 2 Fans, 3 Lights ] ───▶ [ AC Mains 220V Line ]
```

---

## 2. Pin Mapping Table

| ESP32 Pin | Component Pin | Component Name | Description / Signal |
| :--- | :--- | :--- | :--- |
| **GND** | GND | Relay Board / ACS712 | Common ground reference |
| **5V / VIN** | VCC | Relay Board / ACS712 | 5V DC Operating power |
| **GPIO 12** | IN 1 | Relay Channel 1 | Control signal for **Fan 1** (Active-Low) |
| **GPIO 13** | IN 2 | Relay Channel 2 | Control signal for **Fan 2** (Active-Low) |
| **GPIO 14** | IN 3 | Relay Channel 3 | Control signal for **Light 1** (Active-Low) |
| **GPIO 15** | IN 4 | Relay Channel 4 | Control signal for **Light 2** (Active-Low) |
| **GPIO 16** | IN 5 | Relay Channel 5 | Control signal for **Light 3** (Active-Low) |
| **GPIO 34** | OUT | ACS712 Sensor | Analog out representing AC current (via voltage divider) |

---

## 3. Connection List (Wiring Description)

### Low Voltage Control Side
1. Connect ESP32 **VIN (5V)** pin to the `VCC` pin of the **5-channel relay board** and the `VCC` pin of the **ACS712 current sensor**.
2. Connect ESP32 **GND** pin to the `GND` pin of the relay board and the `GND` pin of the ACS712 sensor.
3. Connect ESP32 outputs **GPIO 12, 13, 14, 15, and 16** to the relay input trigger pins **IN 1, IN 2, IN 3, IN 4, and IN 5** respectively.
4. **ACS712 Sensor Divider**:
   - The ACS712 output changes from `0` to `5V` (centered at `2.5V` for zero current).
   - ESP32 Analog pins only accept a maximum of `3.3V`.
   - Connect a **10 kΩ resistor** from ACS712 `OUT` to a junction point.
   - Connect a **20 kΩ resistor** from the junction point to **GND**.
   - Connect the junction point (which scales the voltage down by 2/3, making 5V output read as 3.3V) to ESP32 **GPIO 34** (ADC1 Channel 6).

### High Voltage AC Power Side (220V AC)
1. Connect the **AC Live Line** to the `IP+` screw terminal of the ACS712 current sensor.
2. Connect the `IP-` screw terminal of the ACS712 current sensor to the **Common (COM)** terminal of all 5 relays in parallel.
3. Connect the **Normally Open (NO)** terminal of:
   - Relay 1 to the Live terminal of **Fan 1**.
   - Relay 2 to the Live terminal of **Fan 2**.
   - Relay 3 to the Live terminal of **Light 1**.
   - Relay 4 to the Live terminal of **Light 2**.
   - Relay 5 to the Live terminal of **Light 3**.
4. Connect all **Neutral lines** of the 2 fans and 3 lights back to the **AC Neutral Line** to close the high voltage circuit.

---

## 4. Electrical Reasoning & Component Choice

1. **Opto-Isolated Relays**:
   We choose an opto-isolated relay board. Optocouplers provide galvanic isolation between the low-voltage ESP32 controller and the high-voltage 220V AC lines, preventing voltage spikes (caused by inductive loads like fans switching off) from traveling back to and frying the ESP32.
2. **Current Sensing via Hall Effect (ACS712)**:
   The ACS712 uses a Hall-effect sensor to measure current inline. The copper conduction path has an extremely low internal resistance (1.2 mΩ), which ensures power dissipation is negligible.
3. **Calculating Power (Watts)**:
   The ESP32 samples the analog pin on GPIO 34 at high frequency (e.g. 5 kHz) over one or more AC cycles (50Hz / 60Hz).
   - The RMS Current ($I_{RMS}$) is calculated as:
     $$I_{RMS} = \sqrt{\frac{1}{N}\sum_{i=1}^N (I_i - I_{offset})^2}$$
   - Assuming a standard nominal voltage of $V_{RMS} = 220V$, Active Power is calculated as:
     $$P = V_{RMS} \times I_{RMS} \times \text{Power Factor (PF)}$$
   - Power Factor is assumed to be `1.0` for resistive lights and `0.85` for inductive fan motors.

---

## 5. Scaling to All 15 Devices (Across 3 Rooms)

To monitor and control all 15 devices in the office (5 devices per room for 3 rooms), we can implement either a **Distributed** or **Centralized** hardware topology.

### Option A: Distributed Room Nodes (Recommended)
In this setup, each of the three rooms has its own independent **ESP32 controller** and **current sensor**. Each ESP32 runs the exact 5-channel circuit defined in Section 2, and communicates status back to the Supabase database via Wi-Fi.

* **Room 1 (Drawing Room)**: ESP32 Node A + 5-channel Relay + ACS712
* **Room 2 (Work Room 1)**: ESP32 Node B + 5-channel Relay + ACS712
* **Room 3 (Work Room 2)**: ESP32 Node C + 5-channel Relay + ACS712

*Advantages*: Minimal high-voltage wiring runs across walls, and localized current sensing gives independent room safety isolating faults to individual rooms.

---

### Option B: Centralized Controller (Single ESP32)
In this setup, a single central ESP32 controls all 15 relays and reads three separate current sensors (one for each room). This is feasible because the ESP32 has sufficient GPIO inputs/outputs.

#### Centralized 15-Device GPIO Pin Mapping:

| Room Name | Device Name | Device Type | ESP32 GPIO Pin |
| :--- | :--- | :--- | :--- |
| **Drawing Room** | Fan 1 | Fan | **GPIO 12** |
| **Drawing Room** | Fan 2 | Fan | **GPIO 13** |
| **Drawing Room** | Light 1 | Light | **GPIO 14** |
| **Drawing Room** | Light 2 | Light | **GPIO 15** |
| **Drawing Room** | Light 3 | Light | **GPIO 16** |
| **Drawing Room** | Current Sensor | Analog Sense | **GPIO 34** (ADC1) |
| | | | |
| **Work Room 1** | Fan 1 | Fan | **GPIO 17** |
| **Work Room 1** | Fan 2 | Fan | **GPIO 18** |
| **Work Room 1** | Light 1 | Light | **GPIO 19** |
| **Work Room 1** | Light 2 | Light | **GPIO 21** |
| **Work Room 1** | Light 3 | Light | **GPIO 22** |
| **Work Room 1** | Current Sensor | Analog Sense | **GPIO 35** (ADC1) |
| | | | |
| **Work Room 2** | Fan 1 | Fan | **GPIO 23** |
| **Work Room 2** | Fan 2 | Fan | **GPIO 25** |
| **Work Room 2** | Light 1 | Light | **GPIO 26** |
| **Work Room 2** | Light 2 | Light | **GPIO 27** |
| **Work Room 2** | Light 3 | Light | **GPIO 32** |
| **Work Room 2** | Current Sensor | Analog Sense | **GPIO 36** (ADC1) |
