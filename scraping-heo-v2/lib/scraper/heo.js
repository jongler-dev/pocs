const puppeteer = require('puppeteer');

const HOME_URL = 'https://www.heo.com/uk/en';
const PRODUCT_URL = (productId) => `${HOME_URL}/product/${productId}`;

const self = {
  browser: null,
  page: null,
  credentials: {},

  async init(credentials, headless = true) {
    if (!credentials?.username || !credentials?.password) {
      throw new Error('Username/Password missing');
    }

    try {
      self.browser = await puppeteer.launch({ headless: headless });
      self.page = await self.browser.newPage();
      self.credentials = credentials;
      await self._login();
    } catch (err) {
      throw err;
    }
  },

  async term() {
    await self.browser?.close();
  },

  async _login() {
    await self.page.goto(HOME_URL, { waitUntil: 'networkidle2' });

    // already logged-in
    let loginText = await self.page.$eval('p.log', (data) => data.innerText);
    if (loginText === 'Logout') {
      console.log('already logged-in');
      return;
    }

    // perform log-in
    await self.page.click('div.login-top');
    await self.page.waitForSelector('div.cbox > input');

    // hack: pressing backspace before email/password values are typed
    // see https://github.com/puppeteer/puppeteer/issues/1648#issuecomment-881521529
    await self.page.click('input[ng-model="user.email"]', { delay: 100 });
    await self.page.keyboard.press('Backspace');
    await self.page.type(
      'input[ng-model="user.email"]',
      self.credentials.username,
      {
        delay: 50,
      }
    );

    await self.page.click('input[ng-model="user.password"]', { delay: 100 });
    await self.page.keyboard.press('Backspace');
    await self.page.type(
      'input[ng-model="user.password"]',
      self.credentials.password,
      {
        delay: 50,
      }
    );

    await self.page.click('div.cbox > input');
    await self.page.waitForSelector('p.log');
    await self.page.waitForTimeout(2000); // just in case :-)

    // verify successful log-in
    loginText = await self.page.$eval('p.log', (data) => data.innerText);
    if (loginText !== 'Logout') {
      throw new Error('Login failed');
    }
  },

  async getProductById(productId) {
    return self.getProductByUrl(PRODUCT_URL(productId));
  },

  async getProductByUrl(url) {
    try {
      await self.page.goto(url, { waitUntil: 'networkidle2' });

      const data = await self.page.evaluate(() => {
        // public product data (does not require login)
        const itemCode = document.querySelector('span.blue').innerText;
        const title = document.querySelector('div.v-align > h1').innerText;
        const category = document.querySelector('div.v-align > h2').innerText;
        const description = document.querySelector('div.v-align > p').innerText;
        const stockStatus = document.querySelector('p.ng-scope').innerText;

        // private product data (requires login)
        const price = document.querySelector('p.total-price').innerText;
        const basePrice = document.querySelector('span.prx').innerText;
        const weight = document.querySelector(
          'div.info-detail > p:nth-child(4)'
        ).innerText;
        const caseQuantity = document.querySelector(
          'div.info-detail > p:nth-child(6)'
        ).innerText;
        const gtin_ean = document.querySelector(
          'div.info-detail > p:nth-child(8)'
        ).innerText;
        const packaging = document.querySelector(
          'div.info-detail > p:nth-child(10)'
        ).innerText;
        const srp = document.querySelector(
          'div.info-detail > div:nth-child(11) > p:nth-child(2)'
        ).innerText;
        const producer = document.querySelector(
          'p.inline > a:nth-child(2)'
        ).innerText;
        const theme = document.querySelector(
          'p.inline > a:nth-child(3)'
        ).innerText;
        const productType = document.querySelector(
          'div.breadcrump > p.b-cat > a:nth-child(1)'
        ).innerText;
        const imagesUrl = document.querySelector(
          'div.button-image > a.button'
        ).href;

        return {
          itemCode,
          title,
          category,
          producer,
          theme,
          productType,
          description,
          stockStatus,
          price,
          basePrice,
          weight,
          caseQuantity,
          gtin_ean,
          packaging,
          srp,
          imagesUrl,
        };
      });

      return { url, ...data };
    } catch (err) {
      console.error(`Failed getting item. Url: ${url}, ${err}`);
      return err;
    }
  },
};

module.exports = self;
