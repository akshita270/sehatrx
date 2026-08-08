import io
import json
import logging

from openai import OpenAI
from pydantic import ValidationError

from app.config import settings
from app.schemas import MedicineItem, PrescriptionDraft, PrescriptionTranslation, TestItem, VitalsItem

logger = logging.getLogger(__name__)

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


class TranscriptionError(Exception):
    pass


class DraftGenerationError(Exception):
    pass


class TranslationError(Exception):
    pass


class SpeechSynthesisError(Exception):
    pass


def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    client = get_client()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename
    try:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
    except Exception as exc:
        logger.exception("Whisper transcription failed")
        raise TranscriptionError(str(exc)) from exc

    text = (result.text or "").strip()
    if not text:
        raise TranscriptionError("Transcription returned empty text")
    return text


PRESCRIPTION_JSON_SCHEMA = {
    "name": "prescription_draft",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "chiefComplaint": {"type": "string"},
            "diagnosis": {"type": "string"},
            "vitals": {
                "type": "object",
                "properties": {
                    "temperature": {"type": "string"},
                    "bloodPressure": {"type": "string"},
                    "pulse": {"type": "string"},
                    "weight": {"type": "string"},
                },
                "required": ["temperature", "bloodPressure", "pulse", "weight"],
                "additionalProperties": False,
            },
            "medicines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "dose": {"type": "string"},
                        "freq": {"type": "string"},
                        "duration": {"type": "string"},
                        "durationInferred": {"type": "boolean"},
                        "timing": {"type": "string"},
                        "timingWhen": {"type": "string"},
                    },
                    "required": ["name", "dose", "freq", "duration", "durationInferred", "timing", "timingWhen"],
                    "additionalProperties": False,
                },
            },
            "tests": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "instructions": {"type": "string"},
                    },
                    "required": ["name", "instructions"],
                    "additionalProperties": False,
                },
            },
            "dietAdvice": {"type": "string"},
            "advice": {"type": "string"},
            "newAllergyMentioned": {"type": "string"},
        },
        "required": [
            "chiefComplaint",
            "diagnosis",
            "vitals",
            "medicines",
            "tests",
            "dietAdvice",
            "advice",
            "newAllergyMentioned",
        ],
        "additionalProperties": False,
    },
}

SYSTEM_PROMPT = (
    "You are a clinical scribe assistant helping a doctor draft a prescription from a "
    "doctor-patient consultation transcript. Consultations in Indian clinics are frequently "
    "conducted in Hindi, English, or a Hindi-English code-switched mix (Hinglish); the transcript "
    "may contain any of these, sometimes within the same sentence. Understand it regardless of "
    "language, but always write the extracted chiefComplaint, diagnosis, dietAdvice, and advice in "
    "clear, standard medical English, as is conventional for prescriptions written by Indian doctors, "
    "even when the conversation itself was in Hindi or Hinglish. Medicine names should be kept in "
    "their standard pharmaceutical form. Extract the chief complaint, a likely diagnosis, any vitals "
    "explicitly stated (temperature, blood pressure, pulse, weight - each with its unit, e.g. "
    "'101°F', '120/80 mmHg', '88 bpm', '68 kg'; leave a vital as an empty string if it was not stated "
    "- never estimate or invent a vital reading), any medicines mentioned (with dose, frequency, "
    "duration, and timing relative to food - leave duration as an empty string only if the transcript "
    "gives you no number of days to go on at all. Indian doctors very often state a medicine's duration "
    "indirectly, as a follow-up window rather than a direct instruction - e.g. 'agar 3 din mein aaram na "
    "aaye to wapas aana' / 'if you don't feel better in 3 days, come back' is how they commonly say "
    "'take this for 3 days, then we'll reassess'. When no medicine was given its own separate, more "
    "specific duration, use that follow-up number of days as the duration for the medicines being "
    "prescribed in that consultation (e.g. duration: '3 days'). Only leave duration blank when the "
    "transcript truly contains no number of days anywhere - never invent a number that was never said. "
    "Each medicine also has a durationInferred flag: set it to true when you filled in duration using "
    "the follow-up-window rule above rather than a number the doctor stated specifically for that "
    "medicine, so the doctor can double-check it before approving. Set it to false whenever the doctor "
    "gave that exact medicine its own explicit duration, or whenever duration is left as an empty "
    "string), any lab or diagnostic tests the doctor recommended (e.g. "
    "CBC, blood sugar, urine routine, X-ray) with any instructions given for them (e.g. 'fasting "
    "required', 'morning sample'; leave instructions as an empty string if none were given), any "
    "dietary guidance the doctor gave (specific foods to eat or avoid, e.g. 'eat dal khichdi for two "
    "days', 'bland/light food only', 'drink ORS', 'boiled vegetables', 'avoid spicy and oily food', "
    "'plenty of fluids'; leave dietAdvice as an empty string if no dietary guidance was given - do not "
    "invent it), and general advice given to the patient that is not about food (e.g. rest, sleep, "
    "activity restrictions, follow-up timing). Each medicine has two separate timing fields, and the "
    "doctor may give either, both, or neither - extract them independently, never merge one into the "
    "other: "
    "(1) 'timing' is the relation to food - use one of the short standard phrases 'Before Food', "
    "'After Food', 'With Food', 'Empty Stomach', or 'Anytime' when that's what the doctor meant (e.g. "
    "'khaali pet' -> 'Empty Stomach', 'khaana khaane ke baad' -> 'After Food'). Leave it as '' (empty "
    "string) if the doctor did not say anything about food relation for that medicine - never guess it. "
    "(2) 'timingWhen' is the time of day or clock time - e.g. 'subah' -> 'Morning', 'raat ko' -> "
    "'Night', 'dopahar' -> 'Afternoon', 'shaam' -> 'Evening'. If the doctor instead gave a specific "
    "clock time or other concrete instruction (e.g. 'between 12 and 1 PM', 'at bedtime', 'early "
    "morning'), write that exact instruction instead of forcing it into one of those short words - "
    "never lose a specific time the doctor actually said. Leave timingWhen as '' (empty string) if the "
    "doctor did not say anything about time of day for that medicine - never guess it. "
    "A single medicine can have both fields filled at once when the doctor mentioned both (e.g. 'subah "
    "khaali pet' gives timingWhen='Morning' and timing='Empty Stomach' - two separate pieces of "
    "information, not one to be merged or one to be dropped). "
    "Recommended tests are a distinct field from medicines and from advice - never fold a test into "
    "either of those. Dietary guidance always goes in dietAdvice, never in advice, and vice versa - "
    "keep them strictly separate even if the doctor mentioned them in the same breath. Only use "
    "information present in the transcript. If a field is not discussed, provide your best clinically "
    "reasonable minimal completion rather than leaving it blank, except tests, vitals, and dietAdvice: "
    "leave the tests list empty, and vitals and dietAdvice as empty strings, if not discussed - do not "
    "invent them (medicine duration follows the separate rule given above). Do not invent medicines "
    "that were not mentioned or clearly implied. "
    "Pay close attention to negation words in Hindi (e.g. 'नहीं', 'मत', 'ना') and in English ('not', "
    "'no need', 'don't') - they reverse the meaning of the sentence they're in. Double-check every "
    "instruction, restriction, and test note against the transcript to make sure you have not dropped "
    "or flipped a negation: for example, if the doctor says fasting is NOT required "
    "('फास्टिंग जरूरी नहीं है'), the extracted instruction must say 'fasting not required', never "
    "'fasting required'. "
    "Separately, listen for the patient mentioning any drug or food allergy, or a past adverse/bad "
    "reaction to a medicine, anywhere in the conversation - even if it's unrelated to today's "
    "diagnosis or medicines, and even in passing (e.g. 'mujhe penicillin se allergy hai', 'sulfa "
    "drugs se rash ho jaata hai', 'I'm allergic to...', 'that medicine made me break out last time'). "
    "If this happens, put a short, clear phrase naming the substance and reaction if given (e.g. "
    "'Penicillin', 'Sulfa drugs (rash)') into newAllergyMentioned. Leave newAllergyMentioned as '' "
    "(empty string) if no allergy or adverse reaction was mentioned anywhere in the transcript - never "
    "invent one. "
    "This prescription is read directly by the patient, not another clinician, so never write raw "
    "clinical shorthand into freq, timing, timingWhen, dietAdvice, or advice - always expand it into "
    "plain everyday language a patient can understand, even if that's exactly how the doctor said it. "
    "Common examples: 'BID' or 'BD' -> 'Twice a day', 'TID' or 'TDS' -> 'Three times a day', 'QID' -> "
    "'Four times a day', 'OD' -> 'Once a day', 'HS' -> 'At bedtime', 'PRN' or 'SOS' -> 'As needed', "
    "'STAT' -> 'Right away', 'AC' -> 'Before meals', 'PC' -> 'After meals', 'q4h' -> 'Every 4 hours'. "
    "This applies whether the doctor said the abbreviation out loud or wrote it - the extracted field "
    "must always be the plain-language version, never the shorthand itself."
)

STRICT_RETRY_SUFFIX = (
    "\n\nIMPORTANT: Your previous response did not match the required JSON schema exactly. "
    "Respond with ONLY valid JSON matching the schema - no markdown, no extra keys, no missing keys."
)


def _call_model(transcript: str, strict_retry: bool) -> dict:
    client = get_client()
    system_prompt = SYSTEM_PROMPT + (STRICT_RETRY_SUFFIX if strict_retry else "")

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Consultation transcript:\n\n{transcript}"},
        ],
        response_format={"type": "json_schema", "json_schema": PRESCRIPTION_JSON_SCHEMA},
    )
    content = response.choices[0].message.content
    return json.loads(content)


def draft_prescription(transcript: str) -> PrescriptionDraft:
    last_error: Exception | None = None

    for attempt, strict_retry in enumerate([False, True]):
        try:
            raw = _call_model(transcript, strict_retry=strict_retry)
            return PrescriptionDraft.model_validate(raw)
        except (ValidationError, json.JSONDecodeError) as exc:
            last_error = exc
            logger.warning("Prescription draft validation failed on attempt %d: %s", attempt + 1, exc)
        except Exception as exc:
            logger.exception("GPT-4o prescription drafting failed")
            raise DraftGenerationError(str(exc)) from exc

    raise DraftGenerationError(f"Model output failed schema validation: {last_error}")


TRANSLATION_JSON_SCHEMA = {
    "name": "prescription_translation",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "chiefComplaintHi": {"type": "string"},
            "diagnosisHi": {"type": "string"},
            "medicines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "freqHi": {"type": "string"},
                        "durationHi": {"type": "string"},
                        "timingHi": {"type": "string"},
                        "timingWhenHi": {"type": "string"},
                    },
                    "required": ["freqHi", "durationHi", "timingHi", "timingWhenHi"],
                    "additionalProperties": False,
                },
            },
            "tests": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "instructionsHi": {"type": "string"},
                    },
                    "required": ["instructionsHi"],
                    "additionalProperties": False,
                },
            },
            "dietAdviceHi": {"type": "string"},
            "adviceHi": {"type": "string"},
        },
        "required": ["chiefComplaintHi", "diagnosisHi", "medicines", "tests", "dietAdviceHi", "adviceHi"],
        "additionalProperties": False,
    },
}

TRANSLATION_SYSTEM_PROMPT = (
    "You translate finalized, doctor-approved prescriptions from English into Hindi (Devanagari "
    "script) for patients in India, many of whom cannot read English, especially elderly patients. "
    "Write in simple, everyday Hindi that a layperson can read aloud and understand, not stiff "
    "textbook Hindi. Keep it warm and clear, the way a doctor would explain it to a patient's "
    "family in Hindi. Translate the chief complaint, diagnosis, diet advice, and advice fully - if "
    "diet advice is an empty string, return an empty string for dietAdviceHi. For each medicine, "
    "translate the frequency, duration, timing, and timingWhen into natural spoken Hindi (e.g. 'twice a "
    "day' -> 'दिन में दो बार', '5 days' -> '5 दिन तक', 'Before Food' -> 'खाने से पहले', 'After Food' -> "
    "'खाने के बाद', 'With Food' -> 'खाने के साथ', 'Empty Stomach' -> 'खाली पेट', 'Anytime' -> 'कभी भी', "
    "'Morning' -> 'सुबह', 'Afternoon' -> 'दोपहर', 'Evening' -> 'शाम', 'Night' -> 'रात को'). "
    "Timing and timingWhen may also be a specific instruction rather than one of those standard words, "
    "e.g. 'between 12 and 1 PM' -> 'दोपहर 12 से 1 बजे के बीच', 'at bedtime' -> 'सोने से पहले' - translate "
    "whatever text is given, faithfully and naturally, even if it doesn't match a standard word. If "
    "timing or timingWhen is an empty string, return an empty string for timingHi or timingWhenHi "
    "respectively - they are independent fields, translate whichever ones are non-empty. Do not "
    "translate medicine names or doses, they stay in their original form since patients read them off "
    "English packaging. "
    "For each test, translate "
    "only its instructions into natural spoken Hindi (e.g. 'fasting required' -> 'खाली पेट कराना है'); "
    "if instructions are empty, return an empty string - do not translate test names like 'CBC', keep "
    "them as given since patients see the same abbreviation on the lab report. Return exactly one "
    "entry, in the same order, for every medicine and every test given to you - never add, remove, or "
    "reorder them."
)


def _build_translation_input(
    chief_complaint: str,
    diagnosis: str,
    diet_advice: str,
    advice: str,
    medicines: list[MedicineItem],
    tests: list[TestItem],
) -> str:
    lines = [
        f"Chief Complaint: {chief_complaint}",
        f"Diagnosis: {diagnosis}",
        "Medicines:",
    ]
    for i, med in enumerate(medicines, start=1):
        timing_bits = ", ".join(filter(None, [med.timingWhen, med.timing]))
        timing_part = f", {timing_bits}" if timing_bits else ""
        lines.append(f"  {i}. {med.name} - {med.dose}, {med.freq}, {med.duration}{timing_part}")
    lines.append("Tests:")
    for i, test in enumerate(tests, start=1):
        lines.append(f"  {i}. {test.name}" + (f" - {test.instructions}" if test.instructions else ""))
    lines.append(f"Diet Advice: {diet_advice}")
    lines.append(f"Advice: {advice}")
    return "\n".join(lines)


def translate_to_hindi(
    chief_complaint: str,
    diagnosis: str,
    diet_advice: str,
    advice: str,
    medicines: list[MedicineItem],
    tests: list[TestItem],
) -> PrescriptionTranslation:
    client = get_client()
    user_content = _build_translation_input(chief_complaint, diagnosis, diet_advice, advice, medicines, tests)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": TRANSLATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_schema", "json_schema": TRANSLATION_JSON_SCHEMA},
        )
        raw = json.loads(response.choices[0].message.content)
        translation = PrescriptionTranslation.model_validate(raw)
    except Exception as exc:
        logger.warning("Hindi translation failed: %s", exc)
        raise TranslationError(str(exc)) from exc

    if len(translation.medicines) != len(medicines):
        logger.warning(
            "Hindi translation medicine count mismatch: expected %d, got %d",
            len(medicines),
            len(translation.medicines),
        )
        raise TranslationError("Translated medicine count did not match the prescription")

    if len(translation.tests) != len(tests):
        logger.warning(
            "Hindi translation test count mismatch: expected %d, got %d",
            len(tests),
            len(translation.tests),
        )
        raise TranslationError("Translated test count did not match the prescription")

    return translation


def synthesize_speech(text: str) -> bytes:
    client = get_client()
    try:
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text,
        )
    except Exception as exc:
        logger.exception("Speech synthesis failed")
        raise SpeechSynthesisError(str(exc)) from exc

    return response.content
