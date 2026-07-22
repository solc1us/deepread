const interCss = `
  @font-face {
    font-family: 'Inter';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url(https://fonts.gstatic.com/e2e-inter.woff2) format('woff2');
  }
`;

module.exports = new Proxy({}, { get: () => interCss });
