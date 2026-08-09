from pathlib import Path

from weasyprint import HTML

from app.models import Prescription

FONTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"

COLORS = {
    "primary_dark": "#093F44",
    "primary": "#0D5C63",
    "text": "#16262A",
    "text_soft": "#5C726E",
    "border": "#DFE6E3",
    "bg": "#F5F7F5",
    "danger": "#C1443B",
    "danger_soft": "#FBEAE8",
}


def _escape(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_prescription_pdf(prescription: Prescription, lang: str) -> bytes:
    """Render a prescription as a downloadable PDF, in English or Hindi.

    Uses WeasyPrint (Pango/HarfBuzz under the hood) rather than a lower-level PDF
    library, because Devanagari needs real text shaping - vowel signs (matras) are
    stored after the consonant they modify in Unicode but rendered before/around it,
    and a naive glyph-by-codepoint renderer draws them in the wrong order.
    """
    hi = lang == "hi"

    doctor = prescription.consultation.doctor
    patient = prescription.consultation.patient

    def field(en: str | None, hi_text: str | None) -> str:
        return ((hi_text if hi else en) or en or "").strip()

    def section(title: str, body: str) -> str:
        if not body:
            return ""
        return f"""
        <div class="section">
          <div class="section-label">{_escape(title)}</div>
          <div class="section-body">{_escape(body).replace(chr(10), '<br/>')}</div>
        </div>
        """

    chief_complaint = field(prescription.chief_complaint, prescription.chief_complaint_hi)
    diagnosis = field(prescription.diagnosis, prescription.diagnosis_hi)
    diet_advice = field(prescription.diet_advice, prescription.diet_advice_hi)
    advice = field(prescription.advice, prescription.advice_hi)

    vitals_pairs = [
        (("तापमान" if hi else "Temp"), prescription.temperature),
        (("बीपी" if hi else "BP"), prescription.blood_pressure),
        (("पल्स" if hi else "Pulse"), prescription.pulse),
        (("वज़न" if hi else "Weight"), prescription.weight),
    ]
    vitals_html = "   ·   ".join(f"{_escape(l)}: {_escape(v)}" for l, v in vitals_pairs if v)

    medicine_rows = ""
    if prescription.medicines:
        for m in prescription.medicines:
            timing_bits = " · ".join(
                filter(None, [field(m.timing_when, m.timing_when_hi), field(m.timing, m.timing_hi)])
            )
            medicine_rows += f"""
            <tr>
              <td>{_escape(m.name)}</td>
              <td>{_escape(m.dose)}</td>
              <td>{_escape(field(m.frequency, m.frequency_hi))}</td>
              <td>{_escape(timing_bits) or '-'}</td>
              <td>{_escape(field(m.duration, m.duration_hi))}</td>
            </tr>
            """

    tests_text = "; ".join(
        t.name + ((" (" + field(t.instructions, t.instructions_hi) + ")") if t.instructions else "")
        for t in prescription.tests
    )

    font_family = "'Noto Sans Devanagari', 'Noto Sans'" if hi else "'Noto Sans'"

    html = f"""
    <html>
    <head>
    <style>
        @font-face {{
            font-family: 'Noto Sans';
            src: url('file://{FONTS_DIR / "NotoSans-Regular.ttf"}');
        }}
        @font-face {{
            font-family: 'Noto Sans Devanagari';
            src: url('file://{FONTS_DIR / "NotoSansDevanagari-Regular.ttf"}');
        }}
        @page {{ size: A4; margin: 18mm; }}
        body {{
            font-family: {font_family}, sans-serif;
            color: {COLORS['text']};
            font-size: 10.5pt;
            line-height: 1.5;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            padding-bottom: 14px;
            border-bottom: 1px solid {COLORS['border']};
            margin-bottom: 18px;
        }}
        .header .right {{ text-align: right; }}
        .doctor-name {{ font-size: 15pt; font-weight: 700; color: {COLORS['primary_dark']}; }}
        .patient-name {{ font-size: 12pt; font-weight: 700; }}
        .meta {{ font-size: 9pt; color: {COLORS['text_soft']}; margin-top: 2px; }}
        .section {{ margin-bottom: 14px; }}
        .section-label {{ font-size: 9pt; color: {COLORS['text_soft']}; margin-bottom: 3px; }}
        .section-body {{ font-size: 10.5pt; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 4px; }}
        th {{
            background: {COLORS['bg']};
            text-align: left;
            font-size: 9pt;
            color: {COLORS['primary_dark']};
            padding: 6px 8px;
            border: 1px solid {COLORS['border']};
        }}
        td {{
            font-size: 9.5pt;
            padding: 6px 8px;
            border: 1px solid {COLORS['border']};
        }}
        .footer {{ margin-top: 24px; font-size: 8pt; color: {COLORS['text_soft']}; }}
        .allergy-box {{
            background: {COLORS['danger_soft']};
            border: 1.5px solid {COLORS['danger']};
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 16px;
        }}
        .allergy-label {{
            font-size: 9.5pt;
            font-weight: 700;
            color: {COLORS['danger']};
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }}
        .allergy-body {{ font-size: 11pt; font-weight: 700; color: {COLORS['danger']}; margin-top: 2px; }}
    </style>
    </head>
    <body>
      <div class="header">
        <div class="left">
          <div class="doctor-name">{_escape(doctor.name)}</div>
          <div class="meta">{_escape(doctor.specialization or '')} · {_escape(doctor.clinic or '')}</div>
          <div class="meta">{'पंजीकरण सं.' if hi else 'Reg. No'} {_escape(doctor.reg_no or '-')}</div>
        </div>
        <div class="right">
          <div class="patient-name">{_escape(patient.name)}</div>
          <div class="meta">{'आयु/लिंग' if hi else 'Age/Gender'}: {patient.age or '-'}, {_escape(patient.gender or '-')}</div>
          <div class="meta">{prescription.created_at.strftime('%d %b %Y')}</div>
        </div>
      </div>

      {f'''
      <div class="allergy-box">
        <div class="allergy-label">{'ज्ञात एलर्जी' if hi else 'Known Allergies'}</div>
        <div class="allergy-body">{_escape(patient.known_allergies)}</div>
      </div>
      ''' if patient.known_allergies else ''}

      {section('मुख्य शिकायत' if hi else 'Chief Complaint', chief_complaint)}
      {section('निदान' if hi else 'Diagnosis', diagnosis)}
      {section('वाइटल्स' if hi else 'Vitals', vitals_html) if vitals_html else ''}

      {f'''
      <div class="section">
        <div class="section-label">{'दवाइयाँ' if hi else 'Medicines'}</div>
        <table>
          <tr>
            <th>{'नाम' if hi else 'Name'}</th>
            <th>{'खुराक' if hi else 'Dose'}</th>
            <th>{'आवृत्ति' if hi else 'Frequency'}</th>
            <th>{'समय' if hi else 'Timing'}</th>
            <th>{'अवधि' if hi else 'Duration'}</th>
          </tr>
          {medicine_rows}
        </table>
      </div>
      ''' if prescription.medicines else ''}

      {section('जांच' if hi else 'Tests / Investigations', tests_text) if tests_text else ''}
      {section('खान-पान' if hi else 'Diet Advice', diet_advice)}
      {section('सलाह' if hi else 'Advice', advice)}

      <div class="footer">
        {'यह एक डिजिटल रूप से जनरेट किया गया प्रिस्क्रिप्शन है।' if hi else 'This is a digitally generated prescription from SehatRx.'}
      </div>
    </body>
    </html>
    """

    return HTML(string=html).write_pdf()
