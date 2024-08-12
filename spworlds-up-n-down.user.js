// ==UserScript==
// @name         SPWorlds - Upvotes and Downvotes viewer
// @namespace    https://github.com/SuhEugene/SPWorlds-UpAndDown
// @version      2024-08-07
// @description  Отображает апвоуты и даунвоуты поста, вместо их разницы.
// @author       SuhEugene, DearFox
// @match        https://spworlds.ru/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=spworlds.ru
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  // Сохраняем оригинальный для вызова в будущем
  const originalFetch = fetch;

  const DIVIDER =
    '<p style="background:#3d3d4b; width:2px; display:inline-block; height: 20px; border-radius:2px; margin: 0 12px;"></p>';

  // Функция для обработки данных поста
  function processPostData(data) {
    if (!data) return console.warn('Переданный ответ пуст');

    if (!data.id) return console.warn('Переданный ответ не содержит идентификатор поста');

    if (data.upvotes === undefined || data.downvotes === undefined)
      return console.warn('Ответ не содержит полей голосов за/против поста');

    const id = data.id;
    const upvotes = data.upvotes;
    const downvotes = data.downvotes;
    console.log(`ID: ${id}, Upvotes: ${upvotes}, Downvotes: ${downvotes}`);

    const updateAnchor = anchor => {
      console.warn('Заменяем ссылку...');
      const originalText = anchor.innerText.split(' : + ')[0];
      anchor.innerText = `${originalText} : + ${upvotes} | - ${downvotes}`;
    };

    // Функция для обновления элемента
    const updatePost = () => {
      const anchor = document.querySelector(`a[href="/sp/feed/${id}"]`);
      if (!anchor) return false;

      const postEl = anchor.closest('.relative.space-y-4');
      if (!postEl) {
        console.warn('Пост не найден');
        updateAnchor(anchor);
        return true;
      }
      const counterEl = postEl.querySelector('button[title=Апвоут] + p');
      if (!counterEl) {
        console.warn('Счётчик не найден');
        updateAnchor(anchor);
        return true;
      }
      const upvoteEl = postEl.querySelector('button[title=Апвоут]');
      const downvoteEl = postEl.querySelector('button[title=Даунвоут]');
      if (!upvoteEl || !downvoteEl) {
        console.warn('Одна из кнопок не найдена');
        updateAnchor(anchor);
        return true;
      }
      const counterParent = upvoteEl.parentElement;
      if (!counterParent) {
        console.warn('Не найден родитель кнопок');
        updateAnchor(anchor);
        return true;
      }

      const upvoteSVGEl = upvoteEl.querySelector('svg');
      const downvoteSVGEl = downvoteEl.querySelector('svg');
      if (!upvoteSVGEl || !downvoteSVGEl) {
        console.warn('SVG одной из кнопок не найден');
        updateAnchor(anchor);
        return true;
      }

      upvoteEl.classList.add('flex');
      upvoteEl.classList.add('font-medium');
      downvoteEl.classList.add('flex');
      downvoteEl.classList.add('font-medium');
      upvoteEl.innerHTML = `${upvoteSVGEl.outerHTML}<span style="color: white;">${upvotes}</span>`;
      downvoteEl.innerHTML = `<span style="color: white;">${downvotes}</span>${downvoteSVGEl.outerHTML}`;

      counterEl.outerHTML = DIVIDER;

      return true;
    };

    // Создание MutationObserver для отслеживания изменений в DOM
    const observer = new MutationObserver(() => updatePost() && observer.disconnect());

    // Начало наблюдения за изменениями в DOM
    observer.observe(document.body, { childList: true, subtree: true });

    // Пытаемся обновить элемент сразу, если он уже существует
    updatePost();
  }

  const GET_METHOD_REGEXES = [
    // Конкретный пост
    /^https:\/\/spworlds\.ru\/api\/[a-z0-9_]+\/posts\/[0-9a-fA-F-]+$/,

    // Посты аккаунта
    /^https:\/\/spworlds\.ru\/api\/[a-z0-9_]+\/posts\/from\/account\/[0-9a-fA-F-]+(\?.*)?$/,

    // Посты группы
    /^https:\/\/spworlds\.ru\/api\/[a-z0-9_]+\/posts\/from\/group\/[0-9a-fA-F-]+(\?.*)?$/,

    // Посты страницы новостей
    /^https:\/\/spworlds\.ru\/api\/[a-z0-9_]+\/posts\?.*$/
  ];

  const checkGetRequest = async (url, options, response) => {
    if (!GET_METHOD_REGEXES.some(regex => regex.test(url))) return;

    try {
      const data = await response.json();
      if (Array.isArray(data)) data.forEach(post => processPostData(post));
      else processPostData(data);
    } catch (error) {
      console.error('Ошибка при разборе ответа на получение поста(ов):', error);
    }
  };

  const UPDATE_POST_REGEX = /^https:\/\/spworlds\.ru\/api\/[a-z0-9_]+\/posts\/[0-9a-fA-F-]+$/;

  const checkPostRequest = async (url, options, response) => {
    const match = url.match(UPDATE_POST_REGEX);
    if (!match) return;

    const [serverUrl] = match;

    const body = options?.body;
    if (!body) return;

    let jsonBody = null;
    try {
      jsonBody = JSON.parse(body);
    } catch (error) {
      console.error('Не удалось пропарсить тело POST запроса к API sp worlds', error);
    }
    if (!jsonBody) return;

    if (jsonBody.isUpvote === undefined || jsonBody.vote === undefined) return;
    try {
      const json = await originalFetch(serverUrl, {
        credentials: 'include'
      }).then(r => r.json());
      if (!json) return;
      processPostData(json);
    } catch (error) {
      console.error('Ошибка кастомного получения поста:', error);
    }
  };

  // Перехват fetch
  window.fetch = async function (url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    if (method === 'GET') {
      const response = await originalFetch.apply(this, arguments);
      checkGetRequest(url, options, response.clone());
      return response;
    } else if (method === 'POST') {
      const response = await originalFetch.apply(this, arguments);
      checkPostRequest(url, options, response.clone());
      return response;
    }

    // Если запрос не соответствует условиям, выполняем его без изменений
    return originalFetch.apply(this, arguments);
  };
})();
