export function microphoneFailure(error){
 if(['NotAllowedError','PermissionDeniedError','SecurityError','not-allowed','service-not-allowed'].includes(error?.name||error?.error))return 'Microphone permission is blocked. Open this site in a regular browser tab, allow the microphone in site settings, and check your computer’s microphone privacy settings. You can keep typing.';
 if(['NotFoundError','DevicesNotFoundError','audio-capture'].includes(error?.name||error?.error))return 'No microphone was found. Connect one and select it in your browser or system audio settings. You can keep typing.';
 if(['NotReadableError','TrackStartError'].includes(error?.name))return 'The microphone is busy or unavailable. Close other recording apps and try again. Your typed explanation is kept.';
 return 'Recording could not start. Check microphone access in a regular browser tab. You can type and submit the same explanation for feedback.';
}
export const microphoneGuide='To use your microphone: open the HTTPS site or localhost in a regular browser, allow this site to record, and check that the correct microphone is selected. Embedded or automated browsers may block recording.';
