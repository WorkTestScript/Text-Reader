const textArea = document.querySelector("#text-area");
const voiceSelect = document.getElementById("voices");
const fontSelect = document.getElementById("font-select");
const speedRange = document.getElementById('speed');
const pitchRange = document.getElementById('pitch');
const lengthHelpBtn = document.getElementById('length-help');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const playBtn = document.querySelector('#play');
const pauseBtn = document.querySelector('#pause');
const fontSizeBtn = document.querySelector('#font-size-btn');
const loopBtn = document.querySelector('#loop');
const lineLoopBtn = document.querySelector('#line-loop');
const autoscrollBtn = document.querySelector('#autoscroll-btn');
const settingBlock = document.querySelector('.setting');
const hideButton = document.querySelector('#setting-hide');

let isAutoscrollEnabled = localStorage.getItem('isAutoscrollEnabled') ? localStorage.getItem('isAutoscrollEnabled') === 'true' : true;
let currentTheme = localStorage.getItem('theme') || 'dark';
const fontClasses = ['font-roboto', 'font-open-sans', 'font-lato', 'font-georgia', 'font-verdana'];

function applyTheme() {
    document.body.classList.remove('light-theme', 'dark-theme-v2', 'dark-theme-v3');
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
    } else if (currentTheme === 'dark-v2') {
        document.body.classList.add('dark-theme-v2');
    } else if (currentTheme === 'dark-v3') {
        document.body.classList.add('dark-theme-v3');
    }
}

function toggleTheme() {
    if (currentTheme === 'dark') {
        currentTheme = 'light';
    } else if (currentTheme === 'light') {
        currentTheme = 'dark-v2';
    } else if (currentTheme === 'dark-v2') {
        currentTheme = 'dark-v3';
    } else {
        currentTheme = 'dark';
    }
    localStorage.setItem('theme', currentTheme);
    applyTheme();
}

function updateAutoscrollButton() {
    if (isAutoscrollEnabled) {
        autoscrollBtn.classList.add('autoscroll-enabled');
    } else {
        autoscrollBtn.classList.remove('autoscroll-enabled');
    }
}

function toggleAutoscroll() {
    isAutoscrollEnabled = !isAutoscrollEnabled;
    localStorage.setItem('isAutoscrollEnabled', isAutoscrollEnabled);
    updateAutoscrollButton();
}

function applyFont(fontClass) {
    textArea.classList.remove(...fontClasses);
    textArea.classList.add(fontClass);
}

applyTheme();
updateAutoscrollButton();

const savedFont = localStorage.getItem('font');
if (savedFont) {
    applyFont(savedFont);
    fontSelect.value = savedFont;
} else {
    applyFont('font-roboto');
}


populateVoiceList();

playBtn.addEventListener("click", handlePlay);
pauseBtn.addEventListener("click", handlePause);
speedRange.addEventListener('input', updateSpeechOnChange);
pitchRange.addEventListener('input', updateSpeechOnChange);
lengthHelpBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    showLengthLimitHelp();
});

themeToggleBtn.addEventListener('click', toggleTheme);
autoscrollBtn.addEventListener('click', toggleAutoscroll);
fontSelect.addEventListener('change', function(event) {
    const selectedFont = event.target.value;
    applyFont(selectedFont);
    localStorage.setItem('font', selectedFont);
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



textArea.addEventListener('paste', (event) => {
    deactivateLineLoop();
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

textArea.addEventListener('input', () => {
    deactivateLineLoop();
});

fontSizeBtn.addEventListener('click', function (event) {
    changeFontSize(event)
});

loopBtn.addEventListener('click', function () {
    handleLoop(loopBtn);
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

hideButton.addEventListener('click', function () {
    settingBlock.classList.toggle('hidden');
    textArea.classList.toggle('textarea-height');
})

window.addEventListener('keydown', function (event) {
    if (event.key === 'Alt') {
        event.preventDefault();
    }
});

window.addEventListener('keyup', function (event) {
    if (event.key === 'Alt') {
        event.preventDefault();
    }
});

document.addEventListener('keydown', function (event) {
    if (document.activeElement !== textArea) {
        if (event.code === 'Space' && !event.repeat) {
            event.preventDefault();
            playBtn.click();
        } else if (event.code === 'ArrowUp') {
            event.preventDefault();
            changeLineSelection(-1);
        } else if (event.code === 'ArrowDown') {
            event.preventDefault();
            changeLineSelection(1);
        }
    }
});

const savedText = localStorage.getItem('textToSpeak');
if (savedText) {
    textArea.innerHTML = savedText;
    // Clear any line-loop highlights that were persisted in localStorage
    const allDivs = textArea.querySelectorAll('div');
    allDivs.forEach(div => div.classList.remove('line-loop-active'));
}

speedRange.value = localStorage.getItem('selectedSpeed') || 1;
pitchRange.value = localStorage.getItem('selectedPitch') || 1;
isLooping = localStorage.getItem('isLooping') === 'true';
isLineLooping = false;
fontSize = parseInt(localStorage.getItem('fontSize')) || 16;
textArea.style.fontSize = fontSize + 'px';

if (isLooping) {
    activeStyleBtn(loopBtn, isLooping);
}

updatePitchAvailability();
if (savedText) {
    selectedSentence();
} else {
    reformatText();
}
