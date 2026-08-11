const synth = window.speechSynthesis || null;
const PLAY = "play";
const PAUSE = "pause";
const RESUME = "resume";
const STOP = 'stop';
const LOOP = 'loop';
const GOOGLE_VOICE_ID = 'google-en-gb-online';
const GOOGLE_VOICE_LABEL = '🇬🇧 Google English UK';
const GOOGLE_VOICE_US_ID = 'google-en-us-online';
const GOOGLE_VOICE_US_LABEL = '🇺🇸 Google English US';
const GOOGLE_TTS_MAX_CHARS = 110;
const GOOGLE_TTS_RETRY_DELAY_MS = 1000;
const GOOGLE_TTS_STALL_MIN_MS = 8000;
const GOOGLE_TTS_STALL_MAX_MS = 25000;
const DEFAULT_PITCH = 1;
const DEFAULT_MAX_FRAGMENT_LENGTH = 100;
const MIN_MAX_FRAGMENT_LENGTH = 50;
const MAX_MAX_FRAGMENT_LENGTH = 200;
const CUSTOM_LENGTH_STORAGE_KEY = 'customMaxFragmentLength';
const MIN_COMMA_SPLIT_WORDS = 5;
const MIN_COMMA_SPLIT_CHARS = 30;

const TITLE_ABBREVIATIONS = [
  'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Capt.', 'Lt.', 'Col.', 'Gen.', 'Sr.', 'Jr.',
  'Rev.', 'Fr.', 'Maj.', 'Sgt.', 'Cmdr.', 'Atty.', 'Hon.', 'Gov.', 'Pres.', 'Supt.',
  'Det.', 'Ofc.', 'Cpl.', 'Pvt.', 'Adm.', 'Amb.', 'Rd.', 'St.', 'Ave.', 'Blvd.',
  'Ct.', 'Ln.', 'Sq.', 'Pl.', 'Fwy.', 'Hwy.', 'P.S.', 'E.g.', 'I.e.', 'vs.', 'etc.',
  'Fig.', 'Figs.', 'No.', 'Nos.', 'Vol.', 'Vols.', 'p.', 'pp.', 'ed.', 'eds.', 'Rev.',
  'Assoc.', 'Dept.', 'Corp.', 'Inc.', 'Ltd.', 'Co.', 'Bro.', 'Bros.', 'Chap.', 'Chaps.',
  'Conf.', 'Confs.', 'Corp.', 'Dist.', 'Ex.', 'Fed.', 'Intl.', 'Jr.', 'M.D.', 'Ph.D.',
  'S.A.', 'U.K.', 'U.S.', 'U.S.A.', 'approx.', 'cont.', 'dept.', 'esp.', 'ext.',
  'info.', 'mgr.', 'min.', 'misc.', 'natl.', 'obs.', 'orig.', 'para.', 'ph.', 'pub.',
  're.', 'sec.', 'tech.', 'temp.', 'univ.', 'v.', 'vs.', 'w.p.m.', 'yr.', 'yrs.'
];
const PERIOD_PLACEHOLDER = '__DOT__'; // A unique placeholder that is unlikely to be in user text

let voices = [];
let fontSize = 16;
let isLooping = false;
let isLineLooping = false;
let isPlaing = false;
let currentSentenceIndex = 0;
let lineLoopRange = null;
let activeEngine = null;
let audioPlayer = null;
let browserQueue = [];
let googleQueue = [];
let currentGoogleChunk = null;
let googleRetryCount = 0;
let googleRecoveryTimer = null;
let shouldRetryPlayback = false;
let textIndex = {
  currentIndex: 0,
  lastIndex: 0
};

function preProcessTextForAbbreviations(text) {
  let processedText = text;
  // Sort abbreviations by length, longest first, to handle cases like "U.S." vs "U.S.A."
  const sortedAbbreviations = [...TITLE_ABBREVIATIONS].sort((a, b) => b.length - a.length);

  sortedAbbreviations.forEach(abbr => {
    const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the abbreviation as a whole word at the beginning of the pattern
    const regex = new RegExp(`\\b${escapedAbbr}(?!\\w)`, 'g');

    processedText = processedText.replace(regex, match => {
      // Inside the matched abbreviation, replace all periods with a placeholder
      return match.replace(/\./g, PERIOD_PLACEHOLDER);
    });
  });
  return processedText;
}

function postProcessTextForAbbreviations(text) {
  // Replace all placeholders back to periods.
  return text.replace(/__DOT__/g, '.');
}

function getMaxFragmentLength() {
  const selectedLength = getConfiguredMaxFragmentLength();
  return shouldUseGoogleVoice()
    ? Math.min(selectedLength, GOOGLE_TTS_MAX_CHARS)
    : selectedLength;
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getConfiguredMaxFragmentLength() {
  const savedLength = parseInt(localStorage.getItem(CUSTOM_LENGTH_STORAGE_KEY), 10);
  if (Number.isNaN(savedLength)) return DEFAULT_MAX_FRAGMENT_LENGTH;
  return clampNumber(savedLength, MIN_MAX_FRAGMENT_LENGTH, MAX_MAX_FRAGMENT_LENGTH);
}

function parseLengthLimitCommand(text) {
  const command = normalizeText(text).match(/^setting\s*-\s*length\s*:\s*(\d+)$/i);
  if (!command) return null;

  const value = parseInt(command[1], 10);
  if (Number.isNaN(value)) return null;

  return clampNumber(value, MIN_MAX_FRAGMENT_LENGTH, MAX_MAX_FRAGMENT_LENGTH);
}

function showModal(firstText, secondText = '') {
  const modal = document.getElementById('modal');
  const modalFirst = document.getElementById('modalFirst');
  const modalSecond = document.getElementById('modalSecond');

  if (!modal || !modalFirst || !modalSecond) return;

  modalFirst.textContent = firstText;
  modalSecond.textContent = secondText;
  modal.classList.add('active');
}

function showLengthLimitHelp() {
  const currentLimit = getConfiguredMaxFragmentLength();
  const modal = document.getElementById('modal');
  const modalFirst = document.getElementById('modalFirst');
  const modalSecond = document.getElementById('modalSecond');

  if (!modal || !modalFirst || !modalSecond) return;

  const command = document.createElement('span');
  command.className = 'modal-command';
  command.textContent = 'setting - length:100';

  modalFirst.textContent = 'To change line length, clear the text field and type:';
  modalSecond.innerHTML = '';
  modalSecond.appendChild(command);
  modalSecond.append(
    document.createElement('br'),
    'Press Play to save it.',
    document.createElement('br'),
    'Allowed values: 50-200.',
    document.createElement('br'),
    `Current value: ${currentLimit}.`
  );
  modal.classList.add('active');
}

function applyLengthLimitCommand() {
  const limit = parseLengthLimitCommand(textArea.innerText);
  if (limit === null) return false;

  localStorage.setItem(CUSTOM_LENGTH_STORAGE_KEY, limit);
  localStorage.removeItem('textToSpeak');
  textArea.innerHTML = '';
  currentSentenceIndex = 0;
  lineLoopRange = null;
  selectedSentence();
  showModal('Line length limit saved', `New value: ${limit}.`);
  return true;
}

function mergeChunksByRegex(text, maxLength, splitter) {
  const pieces = text.split(splitter).filter(Boolean);
  if (pieces.length <= 1) return [];

  const chunks = [];
  let currentChunk = '';

  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    const candidate = `${currentChunk}${piece}`;

    if (candidate.trim().length <= maxLength) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = piece.trimStart();
      continue;
    }

    return [];
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 1 ? chunks : [];
}

function findBalancedBreakIndex(text, idealEnd, maxEnd) {
  const safeMinEnd = 1;
  const safeMaxEnd = Math.min(text.length - 1, maxEnd);
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let index = safeMinEnd; index <= safeMaxEnd; index += 1) {
    if (!/\s/.test(text[index])) continue;

    const distance = Math.abs(index - idealEnd);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }

  if (bestIndex !== -1) return bestIndex;
  return Math.min(Math.max(idealEnd, safeMinEnd), safeMaxEnd);
}

function splitTextBalancedByLength(text, maxLength) {
  const normalizedText = normalizeText(text);
  if (normalizedText.length <= maxLength) return [normalizedText];

  const chunks = [];
  let remainingText = normalizedText;

  while (remainingText.length > maxLength) {
    const chunksLeft = Math.ceil(remainingText.length / maxLength);
    const idealEnd = Math.round(remainingText.length / chunksLeft);
    const breakIndex = findBalancedBreakIndex(remainingText, idealEnd, maxLength);
    const chunk = remainingText.slice(0, breakIndex).trim();

    if (!chunk) break;

    chunks.push(chunk);
    remainingText = remainingText.slice(breakIndex).trim();
  }

  if (remainingText) chunks.push(remainingText);
  return chunks.flatMap(chunk => (
    chunk.length <= maxLength ? [chunk] : hardSplitSentence(chunk, maxLength)
  ));
}

function countWords(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

function splitOnceByComma(sentence, maxLength) {
  const commaMatches = [...sentence.matchAll(/,/g)];

  for (const match of commaMatches) {
    const commaIndex = match.index;
    const beforeComma = sentence.slice(0, commaIndex + 1).trim();
    const afterComma = sentence.slice(commaIndex + 1).trim();

    if (beforeComma.length > maxLength) continue;
    if (beforeComma.length < MIN_COMMA_SPLIT_CHARS) continue;
    if (countWords(beforeComma) < MIN_COMMA_SPLIT_WORDS) continue;
    if (countWords(afterComma) < MIN_COMMA_SPLIT_WORDS) continue;

    return [beforeComma, afterComma];
  }

  return null;
}

function hardSplitSentence(sentence, maxLength) {
  const chunks = [];
  let start = 0;

  while (start < sentence.length) {
    const end = Math.min(start + maxLength, sentence.length);
    chunks.push(sentence.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(Boolean);
}

function splitSentenceByLength(sentence, maxLength, allowCommaSplit = true) {
  const normalizedSentence = normalizeText(sentence);
  if (!normalizedSentence) return [];
  if (normalizedSentence.length <= maxLength) return [normalizedSentence];
  if (allowCommaSplit) {
    const commaChunks = splitOnceByComma(normalizedSentence, maxLength);
    if (commaChunks) {
      const [beforeComma, afterComma] = commaChunks;
      return [
        beforeComma,
        ...splitSentenceByLength(afterComma, maxLength, false)
      ];
    }
  }
  if (/\s/.test(normalizedSentence)) return splitTextBalancedByLength(normalizedSentence, maxLength);

  const splitters = [
    /([,;:]+)/,
    /(\s[-–—]\s)/,
    /(\s+)/
  ];

  for (const splitter of splitters) {
    const mergedChunks = mergeChunksByRegex(normalizedSentence, maxLength, splitter);
    if (!mergedChunks.length) continue;

    return mergedChunks.flatMap(chunk => {
      if (chunk.length <= maxLength) return [chunk];
      return splitSentenceByLength(chunk, maxLength, false);
    });
  }

  return hardSplitSentence(normalizedSentence, maxLength);
}

function splitLongSentences(sentences) {
  const maxLength = getMaxFragmentLength();
  return sentences.flatMap(sentence => splitSentenceByLength(sentence, maxLength));
}

function extractSentencesFromText(text) {
  const preProcessedText = preProcessTextForAbbreviations(text);
  return preProcessedText
    .replace(/\r?\n/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(sentence => postProcessTextForAbbreviations(sentence))
    .map(normalizeText)
    .filter(Boolean);
}

function getEditorPlainText() {
  return textArea.innerHTML
    .split(/<\/?div>/)
    .filter(item => item.trim() !== '')
    .map(sentence => sentence.replace(/<.*?>/g, '').replace(/&nbsp;/g, ' '))
    .join(' ');
}

function getEditorLines() {
  return [...textArea.querySelectorAll('div')]
    .map(line => normalizeText(line.innerText || line.textContent || ''))
    .filter(Boolean);
}

function getTextLines(value) {
  return value
    .split(/\n+/)
    .map(normalizeText)
    .filter(Boolean);
}

function isTextAlreadyFormatted(value) {
  const editorLines = getEditorLines();
  if (!editorLines.length) return false;

  const textLines = getTextLines(value);
  if (editorLines.length !== textLines.length) return false;

  return editorLines.every((line, index) => line === textLines[index]);
}

function insertText(value) {
  if (isTextAlreadyFormatted(value)) {
    selectedSentence();
    localStorage.setItem('textToSpeak', textArea.innerHTML);
    return;
  }

  const text = value.replace(/<\/?[^>]+(>|$)/g, "");
  textArea.innerHTML = text;
  const sentencesArray = extractSentencesFromText(text);
  const sentences = splitLongSentences(sentencesArray);
  textArea.innerHTML = sentences.map(item => `<div>${item}</div>`).join('');
  localStorage.setItem('textToSpeak', textArea.innerHTML);
  selectedSentence();
}

function highlight() {
  const blockSentences = textArea.querySelectorAll('div');
  blockSentences.forEach(element => element.classList.remove('textarea-mark'));
  if (blockSentences[currentSentenceIndex]) {
    blockSentences[currentSentenceIndex].classList.add('textarea-mark');
  }
}

function autoscroll(force = false) {
  if (!isAutoscrollEnabled) return;
  if (isLineLooping) return;
  if (!isPlaing && !force) return;
  if (window.getSelection().toString().length > 0) return;

  const { scrollTop, scrollHeight, clientHeight } = textArea;
  const allDivs = textArea.querySelectorAll('div');
  if (!allDivs.length || !allDivs[currentSentenceIndex]) return;
  const currentDiv = allDivs[currentSentenceIndex];
  const divHeight = currentDiv.offsetHeight;
  const divTop = currentDiv.offsetTop;

  if (isPlaing) {
    // Поведінка під час відтворення: зміщуємо на 2 висоти рядка вище центру
    const offset = divHeight * 2;
    textArea.scrollTop = divTop - (clientHeight / 2) + (divHeight / 2) + offset;
  } else if (force) {
    // Поведінка при ручній навігації: як у стандартному textarea
    const padding = 40; // Трохи збільшимо відступ для надійності
    if (divTop < scrollTop + padding) {
      textArea.scrollTop = Math.max(0, divTop - padding);
    } else if (divTop + divHeight > scrollTop + clientHeight - padding) {
      textArea.scrollTop = divTop + divHeight - clientHeight + padding;
    }
  }

  const remainingHeight = Math.floor(scrollHeight - clientHeight - textArea.scrollTop);
  // Прибираємо автоматичний стрибок вгору звідси, щоб дати дочитати останній рядок.
  // Скидання скролу відбудеться в кінці відтворення в спеціальних функціях.
}

function getSelectedVoiceValue() {
  return voiceSelect.value || getFirstLocalVoiceValue();
}

function parseLocalVoiceIndex(value) {
  if (!value || value === GOOGLE_VOICE_ID) return null;
  if (value.startsWith('local:')) {
    const parsed = parseInt(value.replace('local:', ''), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function canUseBrowserSpeech() {
  return Boolean(synth && typeof window.SpeechSynthesisUtterance !== 'undefined');
}

function getSelectedGoogleBrowserVoice() {
  if (!canUseBrowserSpeech()) return null;
  const selectedValue = getSelectedVoiceValue();
  if (selectedValue !== GOOGLE_VOICE_ID && selectedValue !== GOOGLE_VOICE_US_ID) return null;

  const expectedLang = selectedValue === GOOGLE_VOICE_US_ID ? 'en-US' : 'en-GB';
  return voices.find(voice => {
    const voiceName = voice.name.toLowerCase();
    const voiceLang = (voice.lang || '').toLowerCase();
    return voiceName.includes('google') && voiceLang === expectedLang.toLowerCase();
  }) || null;
}

function getSelectedSpeechSynthesisVoice() {
  if (!canUseBrowserSpeech()) return null;
  const selectedIndex = parseLocalVoiceIndex(getSelectedVoiceValue());
  if (selectedIndex !== null) return voices[selectedIndex] || null;
  return getSelectedGoogleBrowserVoice();
}

function getFirstLocalVoiceValue() {
  return voices.length ? 'local:0' : GOOGLE_VOICE_ID;
}

function isPitchEffectivelyEnabled() {
  return Boolean(getSelectedSpeechSynthesisVoice());
}

function shouldUseGoogleVoice() {
  const val = getSelectedVoiceValue();
  return (val === GOOGLE_VOICE_ID || val === GOOGLE_VOICE_US_ID) && !getSelectedGoogleBrowserVoice();
}

function persistPlaybackSettings() {
  localStorage.setItem('selectedSpeed', speedRange.value);
  localStorage.setItem('selectedPitch', pitchRange.value);
  localStorage.setItem('selectedVoice', getSelectedVoiceValue());
  localStorage.setItem('isLooping', isLooping);
  localStorage.setItem('textToSpeak', textArea.innerHTML);
}

function getSentencesForPlayback() {
  const sentences = textArea.innerHTML
    .split(/<\/?div>/)
    .filter(item => item.trim() !== '')
    .map(sentence => {
      const withoutTags = sentence.replace(/<.*?>/g, '');
      return withoutTags.replace(/&nbsp;/g, ' ');
    });
  if (isLineLooping) {
    const range = getLineLoopRange(sentences.length);
    if (!range) return [];
    const start = clampNumber(currentSentenceIndex, range.start, range.end);
    currentSentenceIndex = start;
    return sentences.slice(start, range.end + 1);
  }
  return sentences.slice(currentSentenceIndex);
}

function getLineLoopRange(linesCount) {
  if (!linesCount) return null;
  if (lineLoopRange) {
    const start = Math.min(Math.max(lineLoopRange.start, 0), linesCount - 1);
    const end = Math.min(Math.max(lineLoopRange.end, start), linesCount - 1);
    return { start, end };
  }
  const currentLine = Math.min(Math.max(currentSentenceIndex, 0), linesCount - 1);
  return { start: currentLine, end: currentLine };
}

function getSelectedLineLoopRange() {
  const selection = window.getSelection();
  const lineNodes = [...textArea.querySelectorAll('div')];

  if (!selection || !selection.rangeCount || selection.isCollapsed || !lineNodes.length) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!textArea.contains(range.commonAncestorContainer)) return null;

  const selectedIndexes = lineNodes
    .map((line, index) => range.intersectsNode(line) ? index : -1)
    .filter(index => index !== -1);

  if (!selectedIndexes.length) return null;

  return {
    start: selectedIndexes[0],
    end: selectedIndexes[selectedIndexes.length - 1]
  };
}

function getLineIndexFromNode(node) {
  if (!node) return null;
  const lineNodes = [...textArea.querySelectorAll('div')];
  const element = node.nodeType === 3 ? node.parentElement : node;
  const lineElement = element && element.closest ? element.closest('div') : null;
  const lineIndex = lineNodes.indexOf(lineElement);
  return lineIndex === -1 ? null : lineIndex;
}

function getCaretLineLoopRange() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  if (!textArea.contains(selection.anchorNode)) return null;

  const lineIndex = getLineIndexFromNode(selection.anchorNode);
  if (lineIndex === null) return null;

  return { start: lineIndex, end: lineIndex };
}

function getLineLoopActivationRange() {
  return getSelectedLineLoopRange()
    || getCaretLineLoopRange()
    || getLineLoopRange(textArea.querySelectorAll('div').length);
}

function clearEditorSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (!textArea.contains(range.commonAncestorContainer)) return;

  selection.removeAllRanges();
}

function restartLineLoopIfPlaying() {
  if (playBtn.className !== STOP) return;
  shouldRetryPlayback = true;
  startSpeak(playBtn);
}

function getGoogleLocale() {
  return getSelectedVoiceValue() === GOOGLE_VOICE_US_ID ? 'en-US' : 'en-GB';
}

function getGoogleAudioUrl(text, retryCount = 0) {
  const retryParam = retryCount ? `&retry=${Date.now()}-${retryCount}` : '';
  return `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${getGoogleLocale()}&q=${encodeURIComponent(text)}${retryParam}`;
}

function ensureAudioPlayer() {
  if (!audioPlayer) {
    audioPlayer = new Audio();
    audioPlayer.referrerPolicy = 'no-referrer';
    audioPlayer.setAttribute('referrerpolicy', 'no-referrer');
    audioPlayer.preload = 'auto';
    audioPlayer.addEventListener('ended', handleGoogleAudioEnded);
    audioPlayer.addEventListener('error', handleGoogleAudioError);
    audioPlayer.addEventListener('stalled', handleGoogleAudioError);
  }
  return audioPlayer;
}

function resetPauseButton() {
  pauseBtn.className = PAUSE;
  activeStyleBtn(pauseBtn, false);
}

function cancelGooglePlayback(clearState = true) {
  clearTimeout(googleRecoveryTimer);
  googleRecoveryTimer = null;
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.removeAttribute('src');
    audioPlayer.load();
  }
  googleQueue = [];
  currentGoogleChunk = null;
  googleRetryCount = 0;
  if (clearState) {
    activeEngine = null;
  }
}

function cancelAllPlayback() {
  shouldRetryPlayback = false;
  if (canUseBrowserSpeech()) {
    synth.cancel();
  }
  browserQueue = [];
  cancelGooglePlayback();
  isPlaing = false;
  resetPauseButton();
}

function getUtterance(target, text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = getSelectedSpeechSynthesisVoice();
  utterance.rate = parseFloat(speedRange.value);
  utterance.pitch = parseFloat(pitchRange.value);

  utterance.onstart = () => {
    isPlaing = true;
    activeEngine = 'browser';
    activeStyleBtn(target, true);
    target.className = STOP;
    highlight();
    autoscroll();
  };

  utterance.onend = () => {
    activeStyleBtn(target, false);
    target.className = PLAY;
    currentSentenceIndex += 1;
    textIndex.currentIndex += 1;
    isPlaing = false;
    if (isLineLooping && textIndex.currentIndex >= textIndex.lastIndex) {
      const range = getLineLoopRange(textArea.querySelectorAll('div').length);
      currentSentenceIndex = range ? range.start : 0;
      textIndex.currentIndex = 0;
      startSpeak(target);
      return;
    }
    if (textIndex.currentIndex >= textIndex.lastIndex) {
      currentSentenceIndex = 0;
      if (isLooping) {
        textIndex.currentIndex = 0;
        startSpeak(target);
      }
      return;
    }
    playNextBrowserChunk(target);
  };

  utterance.onerror = (event) => {
    if (!shouldRetryPlayback || target.className !== STOP) return;
    if (event.error === 'canceled' || event.error === 'interrupted') return;

    setTimeout(() => {
      if (!shouldRetryPlayback || target.className !== STOP) return;
      startSpeak(target);
    }, GOOGLE_TTS_RETRY_DELAY_MS);
  };

  persistPlaybackSettings();
  return utterance;
}

function playNextBrowserChunk(target) {
  if (!browserQueue.length) return;
  const nextText = browserQueue.shift();
  const utterance = getUtterance(target, nextText);
  synth.speak(utterance);
}

function finishGooglePlayback() {
  clearTimeout(googleRecoveryTimer);
  googleRecoveryTimer = null;
  activeEngine = null;
  isPlaing = false;
  playBtn.className = PLAY;
  activeStyleBtn(playBtn, false);
  resetPauseButton();
  googleQueue = [];
  currentGoogleChunk = null;
  googleRetryCount = 0;

  if (isLineLooping && textIndex.currentIndex >= textIndex.lastIndex) {
    const range = getLineLoopRange(textArea.querySelectorAll('div').length);
    currentSentenceIndex = range ? range.start : 0;
    textIndex.currentIndex = 0;
    startSpeak(playBtn);
    return;
  }

  if (textIndex.currentIndex === textIndex.lastIndex) {
    currentSentenceIndex = 0;
    textArea.scrollTop = 0;
  }
  if (isLooping && textIndex.lastIndex > 0) {
    textIndex.currentIndex = 0;
    currentSentenceIndex = 0;
    startSpeak(playBtn);
  }
}

function getGoogleRecoveryDelay() {
  if (!currentGoogleChunk) return GOOGLE_TTS_STALL_MIN_MS;
  const speed = Math.max(parseFloat(speedRange.value) || 1, 0.1);
  const chunkDurationEstimate = (currentGoogleChunk.length / 12) * 1000 / speed;
  return Math.min(
    GOOGLE_TTS_STALL_MAX_MS,
    Math.max(GOOGLE_TTS_STALL_MIN_MS, Math.ceil(chunkDurationEstimate + 4000))
  );
}

function scheduleGoogleRecovery() {
  clearTimeout(googleRecoveryTimer);
  googleRecoveryTimer = setTimeout(() => {
    recoverGooglePlayback();
  }, getGoogleRecoveryDelay());
}

function scheduleGoogleRetry() {
  clearTimeout(googleRecoveryTimer);
  googleRecoveryTimer = setTimeout(() => {
    recoverGooglePlayback();
  }, GOOGLE_TTS_RETRY_DELAY_MS);
}

function applyGooglePlaybackSettings() {
  const audio = ensureAudioPlayer();
  audio.playbackRate = parseFloat(speedRange.value) || 1;
  if ('preservesPitch' in audio) {
    audio.preservesPitch = true;
  }
  if ('mozPreservesPitch' in audio) {
    audio.mozPreservesPitch = true;
  }
  if ('webkitPreservesPitch' in audio) {
    audio.webkitPreservesPitch = true;
  }
}

function recoverGooglePlayback() {
  if (!shouldRetryPlayback || !currentGoogleChunk || pauseBtn.className === RESUME) {
    return;
  }

  googleRetryCount += 1;
  const audio = ensureAudioPlayer();
  audio.pause();
  audio.src = getGoogleAudioUrl(currentGoogleChunk, googleRetryCount);
  applyGooglePlaybackSettings();
  scheduleGoogleRecovery();

  audio.play().catch(() => {
    scheduleGoogleRetry();
  });
}

function playNextGoogleChunk(target) {
  if (!currentGoogleChunk && !googleQueue.length) {
    finishGooglePlayback();
    return;
  }

  if (!currentGoogleChunk) {
    currentGoogleChunk = googleQueue.shift();
    googleRetryCount = 0;
  }

  const audio = ensureAudioPlayer();
  audio.src = getGoogleAudioUrl(currentGoogleChunk);
  applyGooglePlaybackSettings();

  isPlaing = true;
  activeEngine = 'google';
  activeStyleBtn(target, true);
  target.className = STOP;
  highlight();
  autoscroll();
  persistPlaybackSettings();
  scheduleGoogleRecovery();

  audio.play().catch(() => {
    scheduleGoogleRetry();
  });
}

function handleGoogleAudioEnded() {
  clearTimeout(googleRecoveryTimer);
  googleRecoveryTimer = null;
  currentSentenceIndex += 1;
  textIndex.currentIndex += 1;
  isPlaing = false;
  currentGoogleChunk = null;
  googleRetryCount = 0;

  if (isLineLooping && textIndex.currentIndex >= textIndex.lastIndex) {
    const range = getLineLoopRange(textArea.querySelectorAll('div').length);
    currentSentenceIndex = range ? range.start : 0;
    textIndex.currentIndex = 0;
    startSpeak(playBtn);
    return;
  }

  if (textIndex.currentIndex >= textIndex.lastIndex) {
    textArea.scrollTop = 0;
    finishGooglePlayback();
    return;
  }

  playNextGoogleChunk(playBtn);
}

function handleGoogleAudioError() {
  recoverGooglePlayback();
}

function startGoogleSpeak(target, sentences) {
  cancelGooglePlayback(false);
  textIndex.lastIndex = sentences.length;
  textIndex.currentIndex = 0;
  googleQueue = [...sentences];

  if (!googleQueue.length) {
    finishGooglePlayback();
    return;
  }

  playNextGoogleChunk(target);
}

function startBrowserSpeak(target, sentences) {
  if (canUseBrowserSpeech()) {
    synth.cancel();
  }
  browserQueue = [...sentences];
  textIndex.lastIndex = browserQueue.length;
  textIndex.currentIndex = 0;

  playNextBrowserChunk(target);
}

function startSpeak(target) {
  const retryRequested = shouldRetryPlayback;
  cancelAllPlayback();
  shouldRetryPlayback = retryRequested;

  const sentences = getSentencesForPlayback();
  if (!sentences.length) return;

  if (shouldUseGoogleVoice()) {
    startGoogleSpeak(target, sentences);
    return;
  }

  startBrowserSpeak(target, sentences);
}

function activeStyleBtn(target, status) {
  if (status) {
    target.style.outline = '2px solid #3498db';
    target.style.backgroundColor = '#4f5254';
  } else {
    target.style.outline = '';
    target.style.backgroundColor = '';
    target.style.color = '';
  }
}

function populateVoiceList() {
  voices = canUseBrowserSpeech() ? synth.getVoices() : [];
  const savedVoice = localStorage.getItem('selectedVoice') || getFirstLocalVoiceValue();
  voiceSelect.innerHTML = '';

  const googleOption = document.createElement('option');
  googleOption.value = GOOGLE_VOICE_ID;
  googleOption.textContent = GOOGLE_VOICE_LABEL;
  voiceSelect.appendChild(googleOption);

  const googleUsOption = document.createElement('option');
  googleUsOption.value = GOOGLE_VOICE_US_ID;
  googleUsOption.textContent = GOOGLE_VOICE_US_LABEL;
  voiceSelect.appendChild(googleUsOption);

  voices.forEach(function (voice, index) {
    const option = document.createElement('option');
    option.value = `local:${index}`;
    option.textContent = voice.name;
    voiceSelect.appendChild(option);
  });

  if (savedVoice === GOOGLE_VOICE_ID || savedVoice === 'google-en-online') {
    voiceSelect.value = GOOGLE_VOICE_ID;
  } else if (savedVoice === GOOGLE_VOICE_US_ID) {
    voiceSelect.value = GOOGLE_VOICE_US_ID;
  } else {
    const legacyIndex = parseLocalVoiceIndex(savedVoice);
    const localValue = legacyIndex !== null ? `local:${legacyIndex}` : savedVoice;
    if ([...voiceSelect.options].some(option => option.value === localValue)) {
      voiceSelect.value = localValue;
    } else {
      voiceSelect.value = getFirstLocalVoiceValue();
    }
  }
}

function handlePlay({ target }) {
  if (applyLengthLimitCommand()) return;

  if (target.className === PLAY) {
    shouldRetryPlayback = true;
    isPlaing = true;
    clearEditorSelection();
    startSpeak(target);
    return;
  }

  if (target.className === STOP) {
    shouldRetryPlayback = false;
    target.className = PLAY;
    activeStyleBtn(target, false);
    cancelAllPlayback();
    selectedSentence();
  }
}

function handlePause({ target }) {
  if (activeEngine === 'google') {
    const audio = ensureAudioPlayer();
    if (target.className === PAUSE) {
      target.className = RESUME;
      activeStyleBtn(target, true);
      clearTimeout(googleRecoveryTimer);
      googleRecoveryTimer = null;
      audio.pause();
      return;
    }
    if (target.className === RESUME) {
      target.className = PAUSE;
      activeStyleBtn(target, false);
      audio.play().catch(() => {
        handleGoogleAudioError();
      });
      scheduleGoogleRecovery();
    }
    return;
  }

  if (!canUseBrowserSpeech()) return;

  if (target.className === PAUSE) {
    target.className = RESUME;
    activeStyleBtn(target, true);
    synth.pause();
    return;
  }
  if (target.className === RESUME) {
    target.className = PAUSE;
    activeStyleBtn(target, false);
    synth.resume();
  }
}

function handleLoop({ target }) {
  if (target.className !== LOOP) return;
  isLooping = !isLooping;
  activeStyleBtn(target, isLooping);
}

function handleLineLoop({ target }) {
  isLineLooping = !isLineLooping;
  if (isLineLooping) {
    lineLoopRange = getLineLoopActivationRange();
    if (lineLoopRange) {
      currentSentenceIndex = lineLoopRange.start;
    }
    restartLineLoopIfPlaying();
  } else {
    lineLoopRange = null;
  }
  highlightLineLoopRange();
  activeStyleBtn(target, isLineLooping);
  localStorage.setItem('isLineLooping', isLineLooping);
}

function deactivateLineLoop() {
  if (!isLineLooping) return;
  isLineLooping = false;
  lineLoopRange = null;
  highlightLineLoopRange();
  activeStyleBtn(lineLoopBtn, false);
  localStorage.setItem('isLineLooping', false);
}

function changeFontSize({ target }) {
  if (target.id === 'font-size-increase') fontSize += 1;
  if (target.id === 'font-size-decrease') fontSize -= 1;
  textArea.style.fontSize = fontSize + 'px';
  localStorage.setItem('fontSize', fontSize);
}

function playChange(plaing) {
  shouldRetryPlayback = plaing;
  cancelAllPlayback();
  shouldRetryPlayback = plaing;
  isPlaing = plaing;
  playBtn.className = plaing ? STOP : PLAY;
  activeStyleBtn(playBtn, plaing);
}

function updateSpeechOnChange() {
  persistPlaybackSettings();
  if (activeEngine === 'google' && isPlaing) {
    applyGooglePlaybackSettings();
    scheduleGoogleRecovery();
    return;
  }
  playChange(true);
  startSpeak(playBtn);
}

function reformatText() {
  playChange(false);
  currentSentenceIndex = 0;
  deactivateLineLoop();
  const cleanedText = getEditorPlainText();
  const sentencesArray = extractSentencesFromText(cleanedText);
  const sentences = splitLongSentences(sentencesArray);
  textArea.innerHTML = sentences.map(item => `<div>${item}</div>`).join('');
  selectedSentence();
}

function highlightLineLoopRange() {
  const allDivs = textArea.querySelectorAll('div');
  allDivs.forEach(div => div.classList.remove('line-loop-active'));

  if (isLineLooping && lineLoopRange) {
    for (let i = lineLoopRange.start; i <= lineLoopRange.end; i++) {
      if (allDivs[i]) {
        allDivs[i].classList.add('line-loop-active');
      }
    }
  }
}

function updatePitchAvailability() {
  const pitchEnabled = isPitchEffectivelyEnabled();
  pitchRange.disabled = !pitchEnabled;
}

function selectedSentence() {
  const childDivs = textArea.querySelectorAll('div');
  childDivs.forEach((div, index) => {
    div.classList.remove('textarea-mark');
    div.onclick = function () {
      if (isPlaing) return;
      if (window.getSelection().toString().length > 0) return;

      if (isLineLooping) {
        // If line loop is active, only allow clicks within the loop range.
        if (lineLoopRange && index >= lineLoopRange.start && index <= lineLoopRange.end) {
          currentSentenceIndex = index;
        } else {
          // Click is outside the loop, do nothing.
          return;
        }
      } else {
        // Normal behavior when line loop is not active.
        currentSentenceIndex = index;
      }
      highlight();
      autoscroll();
    };
  });
}

function changeLineSelection(direction) {
  if (isPlaing) return;
  const childDivs = textArea.querySelectorAll('div');
  if (!childDivs.length) return;

  let minIndex = 0;
  let maxIndex = childDivs.length - 1;

  if (isLineLooping) {
    const range = getLineLoopRange(childDivs.length);
    if (range) {
      minIndex = range.start;
      maxIndex = range.end;
    }
  }

  const newIndex = clampNumber(currentSentenceIndex + direction, minIndex, maxIndex);

  if (newIndex !== currentSentenceIndex) {
    currentSentenceIndex = newIndex;
    highlight();
    autoscroll(true);
    localStorage.setItem('textToSpeak', textArea.innerHTML);
  }
}

function removeSelectedVoice() {
  localStorage.setItem('selectedVoice', voiceSelect.value || getFirstLocalVoiceValue());
  populateVoiceList();
}
