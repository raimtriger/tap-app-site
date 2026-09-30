import { PitchShifter } from './soundtouch-core.js';
window.PitchShifter = PitchShifter;
window.dispatchEvent(new Event('soundtouchready'));
