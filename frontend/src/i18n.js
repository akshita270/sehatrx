import { useState } from "react";

const STRINGS = {
  en: {
    welcome: (name) => `Welcome, ${name}`,
    editProfile: "Edit profile",
    logOut: "Log out",
    yourPrescriptions: "Your Prescriptions",
    yourFamilyPrescriptions: "Family Prescriptions",
    selectPrescription: "Select a prescription",
    loading: "Loading…",
    noPrescriptionsYet: "No prescriptions yet.",
    familyAccess: "Family Access",
    familyAccessDesc: "Let a family member view your prescriptions too.",
    addFamilyMember: "Add Family Member",
    active: "Active",
    pending: "Pending",
    selectAPatient: "Select a patient",
    familyAccessPageTitle: "Family Access",
    familyAccessPageDesc: "View prescriptions for family members who've given you access.",
    noPatientsLinkedDesc:
      "You don't have access to anyone's prescriptions yet. Ask your family member to add you from their patient portal, using this same email address.",
    noPrescriptionsDesc: "You don't have any prescriptions yet. Once your doctor sends one, it'll show up here.",
    patientNoPrescriptions: (name) => `${name} doesn't have any prescriptions yet.`,
    uiLangToggleLabel: "हिंदी",
  },
  hi: {
    welcome: (name) => `स्वागत है, ${name}`,
    editProfile: "प्रोफ़ाइल संपादित करें",
    logOut: "लॉग आउट",
    yourPrescriptions: "आपकी प्रिस्क्रिप्शन",
    yourFamilyPrescriptions: "परिवार की प्रिस्क्रिप्शन",
    selectPrescription: "एक प्रिस्क्रिप्शन चुनें",
    loading: "लोड हो रहा है…",
    noPrescriptionsYet: "अभी तक कोई प्रिस्क्रिप्शन नहीं।",
    familyAccess: "परिवार पहुंच",
    familyAccessDesc: "परिवार के किसी सदस्य को भी अपनी प्रिस्क्रिप्शन देखने दें।",
    addFamilyMember: "परिवार सदस्य जोड़ें",
    active: "सक्रिय",
    pending: "लंबित",
    selectAPatient: "एक मरीज़ चुनें",
    familyAccessPageTitle: "परिवार पहुंच",
    familyAccessPageDesc: "उन परिवार के सदस्यों की प्रिस्क्रिप्शन देखें जिन्होंने आपको पहुंच दी है।",
    noPatientsLinkedDesc:
      "अभी तक आपको किसी की प्रिस्क्रिप्शन देखने की पहुंच नहीं मिली है। अपने परिवार के सदस्य से कहें कि वे अपने मरीज़ पोर्टल से इसी ईमेल पते का उपयोग करके आपको जोड़ें।",
    noPrescriptionsDesc: "अभी तक आपकी कोई प्रिस्क्रिप्शन नहीं है। आपके डॉक्टर के भेजते ही यह यहाँ दिखेगी।",
    patientNoPrescriptions: (name) => `${name} की अभी तक कोई प्रिस्क्रिप्शन नहीं है।`,
    uiLangToggleLabel: "English",
  },
};

export function useUiLang() {
  const [uiLang, setUiLangState] = useState(() => localStorage.getItem("sehatrx_ui_lang") || "en");

  function setUiLang(next) {
    localStorage.setItem("sehatrx_ui_lang", next);
    setUiLangState(next);
  }

  function toggleUiLang() {
    setUiLang(uiLang === "hi" ? "en" : "hi");
  }

  const t = (key, ...args) => {
    const entry = STRINGS[uiLang]?.[key] ?? STRINGS.en[key];
    return typeof entry === "function" ? entry(...args) : entry;
  };

  return { uiLang, setUiLang, toggleUiLang, t };
}
