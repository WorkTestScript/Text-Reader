function removeSelectedVoice() {
  localStorage.setItem('selectedVoice', voiceSelect.value || getFirstLocalVoiceValue());
  populateVoiceList();
}
