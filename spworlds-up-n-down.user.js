// ==UserScript==
// @name         Spworlds SP - Upvotes and Downvotes viewer
// @namespace    http://tampermonkey.net/
// @version      2024-06-30
// @description  Отображает Upvotes и Downvotes поста возле даты публикации поста.
// @author       DearFox and ChatGPT 4o
// @match        https://spworlds.ru/sp/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=spworlds.ru
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  // Функция для обработки данных поста
  function processPostData(data) {
    if (data && data.id && data.upvotes !== undefined && data.downvotes !== undefined) {
      const id = data.id;
      const upvotes = data.upvotes;
      const downvotes = data.downvotes;
      console.log(`ID: ${id}, Upvotes: ${upvotes}, Downvotes: ${downvotes}`);

      // Флаг для отслеживания обновления элемента
      let isUpdated = false;

      // Функция для обновления элемента <a>
      const updateAnchor = () => {
        const anchor = document.querySelector(`a[href="/sp/feed/${id}"]`);
        if (anchor && !isUpdated) {
          anchor.innerHTML += ` : + ${upvotes} | - ${downvotes}`;
          isUpdated = true; // Обновляем флаг после успешного обновления
        }
      };

      // Создание MutationObserver для отслеживания изменений в DOM
      const observer = new MutationObserver(() => {
        updateAnchor();
        if (isUpdated) {
          observer.disconnect(); // Останавливаем наблюдение, как только элемент найден и обновлен
        }
      });

      // Начало наблюдения за изменениями в DOM
      observer.observe(document.body, { childList: true, subtree: true });

      // Пытаемся обновить элемент сразу, если он уже существует
      updateAnchor();
    } else {
      console.error('Ответ не содержит нужные поля.');
    }
  }

  // Перехват fetch
  const originalFetch = fetch;
  window.fetch = async function () {
    const url = arguments[0];
    const options = arguments[1] || {};
    // Проверяем метод запроса
    const method = options.method || 'GET';

    // Регулярные выражения для проверки URL
    const regexPost = /^https:\/\/spworlds\.ru\/api\/sp\/posts\/[0-9a-fA-F-]+$/;
    const regexAccount =
      /^https:\/\/spworlds\.ru\/api\/sp\/posts\/from\/account\/[0-9a-fA-F-]+(\?.*)?$/;
    const regexSort =
      /^https:\/\/spworlds\.ru\/api\/sp\/posts\?sort=new&source=\w+&p=\d+&time=\d+$/;

    if (
      method.toUpperCase() === 'GET' &&
      (regexPost.test(url) || regexAccount.test(url) || regexSort.test(url))
    ) {
      const response = await originalFetch.apply(this, arguments);
      const clonedResponse = response.clone();

      // Обработка ответа
      clonedResponse
        .json()
        .then(data => {
          if (regexPost.test(url)) {
            // Обработка одиночного поста
            processPostData(data);
          } else if ((regexAccount.test(url) || regexSort.test(url)) && Array.isArray(data)) {
            // Обработка массива постов
            data.forEach(post => processPostData(post));
          } else {
            console.error('Ответ не соответствует ожидаемому формату.');
          }
        })
        .catch(error => {
          console.error('Ошибка при разборе ответа:', error);
        });

      return response;
    }

    // Если запрос не соответствует условиям, выполняем его без изменений
    return originalFetch.apply(this, arguments);
  };
  // Your code here...
})();
