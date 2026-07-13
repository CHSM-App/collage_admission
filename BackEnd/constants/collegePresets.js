/**
 * College type → features_config presets.
 *
 * A college's `college_type` decides which bundle of features its admission
 * form uses. The type is the only knob the super-admin turns; it writes the
 * matching features_config below, which is what the form/reviews/validation
 * actually read. Changing a college's type overwrites its features_config
 * with the corresponding preset.
 */

const GENERAL_FEATURES = {
  payment: {
    platform_fee: true,
    college_fee: true,
  },
  admission_form: {
    caste_category: true,
    admitted_category: false,
    other_category: false,
    admission_quota: false,
    hostel_facility: false,
    hsc_subject_flags: false,
    bank_details: true,
    abc_id: true,
    prn: true,
    father_name_split: false,
    date_of_admission: false,
    diploma_direct_sy: false,
    name_as_on_aadhaar: false,
    son_of: false,
    semester: false,
  },
  documents: {
    required_docs: true,
    certificate_checklist: false,
  },
  notifications: {
    whatsapp: true,
    email: true,
  },
};

// Agriculture colleges = general basics + admitted/other category + admission quota
// + hostel facility + HSC subject flags + certificate checklist.
const AGRICULTURE_FEATURES = {
  ...GENERAL_FEATURES,
  payment: {
    ...GENERAL_FEATURES.payment,
    college_fee: false,   // agriculture colleges have no college-fee system
  },
  admission_form: {
    ...GENERAL_FEATURES.admission_form,
    admitted_category: true,
    other_category: true,
    admission_quota: true,
    hostel_facility: true,
    hsc_subject_flags: true,
    date_of_admission: true,
    diploma_direct_sy: true,
    name_as_on_aadhaar: true,
    son_of: true,
    semester: true,
  },
  documents: {
    ...GENERAL_FEATURES.documents,
    certificate_checklist: true,
  },
};

const COLLEGE_TYPE_PRESETS = {
  general: GENERAL_FEATURES,
  agriculture: AGRICULTURE_FEATURES,
};

const COLLEGE_TYPES = Object.keys(COLLEGE_TYPE_PRESETS);

/** Returns the features_config preset for a type, defaulting to 'general'. */
function presetForType(type) {
  return COLLEGE_TYPE_PRESETS[type] || COLLEGE_TYPE_PRESETS.general;
}

/** Whether a given string is a recognised college type. */
function isValidType(type) {
  return Object.prototype.hasOwnProperty.call(COLLEGE_TYPE_PRESETS, type);
}

module.exports = {
  COLLEGE_TYPE_PRESETS,
  COLLEGE_TYPES,
  presetForType,
  isValidType,
};
