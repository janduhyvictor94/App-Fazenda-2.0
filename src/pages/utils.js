// src/pages/utils.js

export const createPageUrl = (pageName) => {
  if (!pageName) return '/';
  return `/${pageName}`;
};