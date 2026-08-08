import pytest
from pydantic import ValidationError

from app.schemas import MedicineItem, PrescriptionDraft, VitalsItem
from app.schemas import TestItem as LabTestItem


def test_medicine_item_requires_core_fields():
    med = MedicineItem(name="Paracetamol", dose="500mg", freq="Twice daily", duration="5 days")
    assert med.timing == ""  # optional, defaults to empty rather than a guessed value


def test_medicine_item_missing_dose_raises():
    with pytest.raises(ValidationError):
        MedicineItem(name="Paracetamol", freq="Twice daily", duration="5 days")


def test_test_item_defaults_instructions_to_empty_string():
    lab_test = LabTestItem(name="CBC")
    assert lab_test.instructions == ""


def test_vitals_item_all_optional_and_empty_by_default():
    vitals = VitalsItem()
    assert vitals.temperature == ""
    assert vitals.bloodPressure == ""
    assert vitals.pulse == ""
    assert vitals.weight == ""


def test_prescription_draft_requires_every_top_level_field():
    with pytest.raises(ValidationError):
        PrescriptionDraft(
            chiefComplaint="Fever",
            diagnosis="Viral fever",
            medicines=[],
            # missing `vitals`, `tests`, `advice`
        )


def test_prescription_draft_accepts_full_valid_payload():
    draft = PrescriptionDraft(
        chiefComplaint="Fever for three days",
        diagnosis="Viral fever",
        vitals=VitalsItem(temperature="102F"),
        medicines=[MedicineItem(name="Paracetamol", dose="500mg", freq="Twice daily", duration="5 days")],
        tests=[LabTestItem(name="CBC", instructions="Fasting required")],
        dietAdvice="Bland diet, khichdi, avoid spicy food.",
        advice="Rest and fluids.",
    )
    assert draft.vitals.temperature == "102F"
    assert draft.medicines[0].name == "Paracetamol"
    assert draft.tests[0].instructions == "Fasting required"
    assert draft.dietAdvice == "Bland diet, khichdi, avoid spicy food."
