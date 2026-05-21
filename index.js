const textArea = document.querySelector("#text-area");
const voiceSelect = document.getElementById("voices");
const speedRange = document.getElementById('speed');
const pitchRange = document.getElementById('pitch');
const lengthHelpBtn = document.getElementById('length-help');
const playBtn = document.querySelector('#play');
const pauseBtn = document.querySelector('#pause');
const fontSizeBtn = document.querySelector('#font-size-btn');
const loopBtn = document.querySelector('#loop');
const lineLoopBtn = document.querySelector('#line-loop');
const startOverBlock = document.querySelector('.mini-setting .setting-start');
const startOverCheckbox = document.querySelector('#start-over');
const startOverBtn = document.querySelector('#start-over-btn');
const settingBlock = document.querySelector('.setting');
const hideButton = document.querySelector('#setting-hide');

populateVoiceList();

playBtn.addEventListener("click", handlePlay);
pauseBtn.addEventListener("click", handlePause);
speedRange.addEventListener('input', updateSpeechOnChange);
pitchRange.addEventListener('input', updateSpeechOnChange);
lengthHelpBtn.addEventListener('click', function (event) {
  event.stopPropagation();
  showLengthLimitHelp();
});

if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = populateVoiceList;
}

textArea.addEventListener('blur', function () {
  insertText(textArea.innerText);
})

textArea.addEventListener('focus', function (event) {
  event.preventDefault();
});

textArea.addEventListener('mousedown', function () {
  deactivateLineLoop();
});

textArea.addEventListener('paste', (event) => {
  event.preventDefault();
  currentSentenceIndex = 0;
  const text = (event.clipboardData || window.clipboardData).getData('text/plain');
  const textNode = document.createTextNode(text);
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(textNode);
    range.collapse(false);
  }
});

fontSizeBtn.addEventListener('click', function (event) {
  changeFontSize(event)
});

loopBtn.addEventListener('click', function (event) {
  handleLoop(event);
});

lineLoopBtn.addEventListener('click', function (event) {
  handleLineLoop(event);
});

lineLoopBtn.addEventListener('mousedown', function (event) {
  event.preventDefault();
});

voiceSelect.addEventListener('change', function () {
  playChange(false);
  removeSelectedVoice();
  updatePitchAvailability();
  reformatText();
});

startOverCheckbox.addEventListener('change', function ({ target }) {
  if (target.checked) startOverBtn.classList.add('start-over-btn-checked');
  else startOverBtn.classList.remove('start-over-btn-checked');
  localStorage.setItem('startOver', target.checked);
});

let checked = localStorage.getItem('startOver') === 'true';

startOverBtn.addEventListener('click', function () {
  checked = !checked
  startOverCheckbox.checked = checked;
  startOverBtn.classList.toggle('start-over-btn-checked');
  localStorage.setItem('startOver', checked);
})

hideButton.addEventListener('click', function () {
  settingBlock.classList.toggle('hidden');
  fontSizeBtn.classList.toggle('hidden');
  textArea.classList.toggle('textarea-height');
})

document.addEventListener('keydown', function (event) {
  if (event.code === 'Space' && !event.repeat) {
    if (document.activeElement !== textArea) {
      event.preventDefault();
      playBtn.click();
    }
  }
});

const savedText = localStorage.getItem('textToSpeak');
if (savedText) {
  textArea.innerHTML = savedText;
}

speedRange.value = localStorage.getItem('selectedSpeed') || 1;
pitchRange.value = localStorage.getItem('selectedPitch') || 1;
isLooping = localStorage.getItem('isLooping') === 'true';
isLineLooping = localStorage.getItem('isLineLooping') === 'true';
startOverCheckbox.checked = checked;
if (checked) startOverBtn.classList.add('start-over-btn-checked');
fontSize = parseInt(localStorage.getItem('fontSize')) || 16;
textArea.style.fontSize = fontSize + 'px';

if (isLooping) {
  activeStyleBtn(loopBtn, isLooping);
}

if (isLineLooping) {
  activeStyleBtn(lineLoopBtn, isLineLooping);
}

updatePitchAvailability();
if (savedText) {
  selectedSentence();
} else {
  reformatText();
}
