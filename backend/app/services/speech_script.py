from app.models import Prescription


def build_speech_script(prescription: Prescription, lang: str) -> str:
    """Assemble a natural spoken-language summary of a prescription for text-to-speech.

    Reuses the already-translated fields rather than calling the model again, so this
    costs nothing beyond the TTS call itself.
    """
    hi = lang == "hi"
    patient_name = prescription.consultation.patient.name
    doctor_name = prescription.consultation.doctor.name

    def field(en: str | None, hi_text: str | None) -> str:
        value = (hi_text if hi else en) or en or ""
        return value.strip()

    lines: list[str] = []

    if hi:
        lines.append(f"नमस्ते {patient_name}। यह डॉ. {doctor_name} की तरफ से आपकी प्रिस्क्रिप्शन है।")
    else:
        lines.append(f"Hello {patient_name}. This is your prescription from Dr. {doctor_name}.")

    complaint = field(prescription.chief_complaint, prescription.chief_complaint_hi)
    if complaint:
        lines.append(("मुख्य शिकायत: " if hi else "Chief complaint: ") + complaint + ".")

    diagnosis = field(prescription.diagnosis, prescription.diagnosis_hi)
    if diagnosis:
        lines.append(("निदान: " if hi else "Diagnosis: ") + diagnosis + ".")

    if prescription.medicines:
        lines.append("आपकी दवाइयाँ हैं:" if hi else "Your medicines are:")
        for i, med in enumerate(prescription.medicines, start=1):
            freq = field(med.frequency, med.frequency_hi)
            timing_when = field(med.timing_when, med.timing_when_hi)
            timing = field(med.timing, med.timing_hi)
            duration = field(med.duration, med.duration_hi)
            parts = [med.name, med.dose, freq]
            if timing_when:
                parts.append(timing_when)
            if timing:
                parts.append(timing)
            if duration:
                parts.append(("कुल " if hi else "for ") + duration)
            lines.append(f"{i}. " + ", ".join(p for p in parts if p) + ".")

    if prescription.tests:
        lines.append("सुझाई गई जांच:" if hi else "Recommended tests:")
        for test in prescription.tests:
            instructions = field(test.instructions, test.instructions_hi)
            lines.append(test.name + (f", {instructions}" if instructions else "") + ".")

    diet_advice = field(prescription.diet_advice, prescription.diet_advice_hi)
    if diet_advice:
        lines.append(("खान-पान: " if hi else "Diet: ") + diet_advice + ".")

    advice = field(prescription.advice, prescription.advice_hi)
    if advice:
        lines.append(("सलाह: " if hi else "Advice: ") + advice + ".")

    return " ".join(lines)
