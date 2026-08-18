// Mutable view state, in one place so no module reaches for a bare global.
//
// Threading these through call signatures instead would be cleaner still; that
// is a follow-up, not part of the mechanical split.

const state = {
  RAW: [],            // all parsed rows (the exercise model)
  impMax: 2,          // show importance <= this
  showVariants: false,
};

const IMP_SLIDER_MAX = 3;  // matches the slider's max attribute

export { state, IMP_SLIDER_MAX };
