document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('modal');
  const modalFirst = document.getElementById('modalFirst');
  const modalSecond = document.getElementById('modalSecond');


  function detectLanguage(text) {
    const cyrillicPattern = /[а-яА-ЯіїєґІЇЄҐ]/;
    return cyrillicPattern.test(text) ? 'uk|en' : 'en|uk';
  }

  function translateText(text, langPair) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.responseData && data.responseData.translatedText) {
          const translation = data.responseData.translatedText;
          modalFirst.textContent = text;
          modalSecond.textContent = translation;
          modal.classList.add('active');
        } else {
          modalFirst.textContent = 'Translation not found ';
          modal.classList.add('active');
        }
      })
      .catch(err => {
        modalFirst.textContent = 'Translation error';
        modal.classList.add('active');
      });
  }

  function cleanWordText(word) {
    if (!word) return '';
    return word.replace(/^[^a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ]+|[^a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ]+$/gu, '').trim();
  }

  function getWordAtCaret() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return '';
    const range = selection.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;

    if (node.nodeType !== Node.TEXT_NODE) {
      if (node.childNodes && node.childNodes[offset]) {
        node = node.childNodes[offset];
        if (node.nodeType === Node.TEXT_NODE) {
          offset = 0;
        } else {
          return '';
        }
      } else {
        return '';
      }
    }

    const text = node.textContent || '';
    if (!text) return '';

    let start = Math.min(Math.max(offset, 0), text.length);
    let end = start;

    while (start > 0 && !/\s/.test(text[start - 1])) {
      start--;
    }
    while (end < text.length && !/\s/.test(text[end])) {
      end++;
    }

    return text.slice(start, end);
  }

  function openYouglishPage(word) {
    const url = `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`;
    window.open(url, '_blank');
  }

  textArea.addEventListener('mouseup', function (event) {
    if (event.ctrlKey && event.altKey) {
      let selectedText = window.getSelection().toString().trim();
      selectedText = cleanWordText(selectedText);
      if (selectedText) {
        openYouglishPage(selectedText);
      }
      else {
        const word = getWordAtCaret();
        const cleanWord = cleanWordText(word);
        if (cleanWord) {
          openYouglishPage(cleanWord);
        }
      }
    } else if (event.ctrlKey) {
      let selectedText = window.getSelection().toString().trim();
      selectedText = cleanWordText(selectedText);
      if (selectedText) {
        const langPair = detectLanguage(selectedText);
        translateText(selectedText, langPair);
      }
      else {
        const word = getWordAtCaret();
        const cleanWord = cleanWordText(word);
        if (cleanWord) {
          const langPair = detectLanguage(cleanWord);
          translateText(cleanWord, langPair);
        }
      }
    } else if (event.altKey) {
      event.preventDefault();
      let selectedText = window.getSelection().toString().trim();
      selectedText = cleanWordText(selectedText);
      if (selectedText) {
        if (typeof speakWord === 'function') {
          speakWord(selectedText);
        }
      } else {
        const word = getWordAtCaret();
        const cleanWord = cleanWordText(word);
        if (cleanWord && typeof speakWord === 'function') {
          speakWord(cleanWord);
        }
      }
    }
  });

  document.addEventListener('click', function (event) {
    if (!modal.contains(event.target)) {
      modal.classList.remove('active');
    }
    if (!textArea.contains(event.target) && !modal.contains(event.target)) {
      textArea.blur();
    }
  });
});