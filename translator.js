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

  function getWordAtCaret() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return '';
    const range = selection.getRangeAt(0).cloneRange();
    const containerNode = range.startContainer;
    let startOffset = range.startOffset;
    range.setStart(containerNode, 0);
    let textBeforeCaret = range.toString().slice(0, startOffset);
    range.setEnd(containerNode, containerNode.length);
    let textAfterCaret = range.toString().slice(startOffset);
    let wordStart = textBeforeCaret.lastIndexOf(' ') + 1;
    let wordEnd = textAfterCaret.indexOf(' ') !== -1 ? textAfterCaret.indexOf(' ') : textAfterCaret.length;
    return textBeforeCaret.slice(wordStart) + textAfterCaret.slice(0, wordEnd);
  }

  function openYouglishPage(word) {
    const url = `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`;
    window.open(url, '_blank');
  }

  textArea.addEventListener('mouseup', function (event) {
    if (event.ctrlKey && event.altKey) {
      let selectedText = window.getSelection().toString().trim();
      selectedText = selectedText.replace(/[.,!?]/g, '');
      if (selectedText) {
        openYouglishPage(selectedText);
        // console.log('selectText openYouglishPage');
      }
      else {
        const word = getWordAtCaret();
        if (word) {
          const cleanWord = word.replace(/[.,!?]/g, '');
          openYouglishPage(cleanWord);
          // console.log('clickText openYouglishPage');
        }
      }
    } else if (event.ctrlKey) {
      let selectedText = window.getSelection().toString().trim();
      selectedText = selectedText.replace(/[.,!?]/g, '');
      if (selectedText) {
        const langPair = detectLanguage(selectedText);
        translateText(selectedText, langPair);
        // console.log('selectText translateText');
      }
      else {
        const word = getWordAtCaret();
        if (word) {
          const cleanWord = word.replace(/[.,!?]/g, '');
          const langPair = detectLanguage(cleanWord);
          translateText(cleanWord, langPair);
          // console.log('clickText translateText');
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