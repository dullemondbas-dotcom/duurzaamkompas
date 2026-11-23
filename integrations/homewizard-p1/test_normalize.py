import unittest
from dk_homewizard_bridge import normalize

class NormalizeTests(unittest.TestCase):
    def test_positive_power_is_grid_import(self):
        result = normalize({"timestamp":"2026-11-23T12:00:00+01:00","unique_id":"meter-1",
            "power_w":850,"energy_import_kwh":1234.5,"energy_export_kwh":123.4}, "serial-1")
        self.assertEqual(result["grid_import_w"], 850)
        self.assertEqual(result["grid_export_w"], 0)
        self.assertEqual(result["grid_import_total_kwh"], 1234.5)
        self.assertEqual(result["grid_export_total_kwh"], 123.4)

    def test_negative_power_is_grid_export(self):
        result = normalize({"power_w":-420}, "serial-2")
        self.assertEqual(result["grid_import_w"], 0)
        self.assertEqual(result["grid_export_w"], 420)

    def test_three_phase_power_is_summed(self):
        result = normalize({"power_l1_w":100,"power_l2_w":200,"power_l3_w":300}, "serial-3")
        self.assertEqual(result["grid_import_w"], 600)

    def test_tariff_registers_are_summed(self):
        result = normalize({"energy_import_t1_kwh":100.2,"energy_import_t2_kwh":55.8,
            "energy_export_t1_kwh":10,"energy_export_t2_kwh":12.5}, "serial-4")
        self.assertAlmostEqual(result["grid_import_total_kwh"],156.0)
        self.assertAlmostEqual(result["grid_export_total_kwh"],22.5)

    def test_event_id_is_stable_for_same_measurement(self):
        reading={"timestamp":"2026-11-23T12:00:00+01:00","unique_id":"meter-5",
            "power_w":120,"energy_import_kwh":20.5,"energy_export_kwh":3.2}
        self.assertEqual(normalize(reading,"serial-5")["source_event_id"],
            normalize(reading,"serial-5")["source_event_id"])

    def test_gas_from_external_meter_is_forwarded(self):
        result = normalize({"timestamp":"2026-11-23T12:00:00",
            "external":[{"type":"gas_meter","value":12.345,"unit":"m3"}]}, "serial-6")
        self.assertEqual(result["gas_total_m3"], 12.345)

    def test_measurement_timestamp_without_timezone_is_dutch_local_time(self):
        result = normalize({"timestamp":"2026-11-23T12:00:00","power_w":50}, "serial-7")
        self.assertIn("+01:00", result["measured_at"])

if __name__ == "__main__":
    unittest.main()
