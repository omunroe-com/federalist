const expect = require('chai').expect;
const moment = require('moment');
const request = require('supertest');

const app = require('../../../app');
const config = require('../../../config');
const { Build } = require('../../../api/models');
const { authenticatedSession } = require('../support/session');
const { sessionForCookie, sessionCookieFromResponse } = require('../support/cookieSession');
const factory = require('../support/factory');

describe('Main Site', () => {
  describe('Home /', () => {
    it('should work', () => {
      request(app)
        .get('/')
        .expect(200);
    });

    it('should contain home page content', () => {
      request(app)
        .get('/')
        .expect(200)
        .then((response) => {
          expect(response.text.indexOf('Federalist compliantly hosts federal government websites.')).to.be.above(-1);
          expect(response.text.indexOf('Log in')).to.be.above(-1);
        });
    });

    it('should redirect to /sites when authenticated', (done) => {
      authenticatedSession()
      .then(cookie => request(app)
        .get('/')
        .set('Cookie', cookie)
        .expect(302)
      )
      .then((response) => {
        expect(response.headers.location).to.equal('/sites');
        done();
      })
      .catch(done);
    });

    it('should display the number of builds from the past week', (done) => {
      Build.destroy({ where: {} }).then(() => {
        const promises = Array.from(Array(10).keys()).map((day) => {
          const date = moment().subtract(day + 1, 'days');
          return factory.build({ createdAt: date });
        });
        return Promise.all(promises);
      })
      .then(() =>
        request(app)
          .get('/')
          .expect(200)
      )
      .then((response) => {
        expect(response.text.indexOf('7 site updates')).to.be.above(-1);
        done();
      })
      .catch(done);
    });
  });

  describe('App /sites', () => {
    it('should redirect to / with a flash error when not authenticated', (done) => {
      request(app)
        .get('/sites')
        .expect(302)
        .then((response) => {
          expect(response.headers.location).to.equal('/');
          const cookie = sessionCookieFromResponse(response);
          return sessionForCookie(cookie);
        })
        .then((sess) => {
          expect(sess.flash.error.length).to.equal(1);
          expect(sess.flash.error[0].title).to.equal('Unauthorized');
          expect(sess.flash.error[0].message).to.equal(
            'You are not permitted to perform this action. Are you sure you are logged in?');
          done();
        })
        .catch(done);
    });

    it('should work when authenticated', (done) => {
      authenticatedSession()
        .then(cookie => request(app)
          .get('/sites')
          .set('Cookie', cookie)
          .expect(200)
        )
        .then(() => done());
    });

    it('should have app content', (done) => {
      authenticatedSession()
      .then(cookie => request(app)
        .get('/sites')
        .set('Cookie', cookie)
        .expect(200)
      )
      .then((response) => {
        expect(response.text.indexOf('Log out')).to.be.above(-1);
        expect(response.text.indexOf('<div id="js-app" class="usa-grid"></div>')).to.be.above(-1);
        done();
      })
      .catch(done);
    });

    it('should contain references to built assets', (done) => {
      authenticatedSession()
        .then(cookie => request(app)
          .get('/sites')
          .set('Cookie', cookie)
          .expect(200)
        )
        .then((response) => {
          const stylesBundleRe = /<link rel="stylesheet" href="\/styles\/styles\.[a-z0-9]*\.css">/;
          expect(response.text.search(stylesBundleRe)).to.be.above(-1);

          const jsBundleRe = /<script src="\/js\/bundle\.[a-z0-9]*\.js"><\/script>/;
          expect(response.text.search(jsBundleRe)).to.be.above(-1);
          done();
        })
        .catch(done);
    });

    it('should contain a csrfToken', (done) => {
      authenticatedSession()
        .then(cookie => request(app)
          .get('/sites')
          .set('Cookie', cookie)
          .expect(200)
        )
        .then((response) => {
          const csrfTokenRe = /window.CSRF_TOKEN = "[a-z0-9_-]+";/i;
          expect(response.text.search(csrfTokenRe)).to.be.above(-1);
          done();
        })
        .catch(done);
    });

    it('should contain front end config values', (done) => {
      authenticatedSession()
        .then(cookie => request(app)
          .get('/sites')
          .set('Cookie', cookie)
          .expect(200)
        )
        .then((response) => {
          expect(response.text.search('FRONTEND_CONFIG')).to.be.above(-1);
          expect(response.text.search('PREVIEW_HOSTNAME')).to.be.above(-1);
          expect(response.text.search('TEMPLATES')).to.be.above(-1);
          done();
        })
        .catch(done);
    });
  });

  describe('.examples', () => {
    it('renders the page properly', (done) => {
      request(app)
      .get('/content/examples/')
      .expect(200)
      .then((response) => {
        expect(response.text.indexOf('example-sites')).to.be.above(-1);
        done();
      })
      .catch(done);
    });

    it('should redirect to /sites when authenticated', (done) => {
      authenticatedSession()
      .then(cookie => request(app)
        .get('/content/examples/')
        .set('Cookie', cookie)
        .expect(302)
      )
      .then((response) => {
        expect(response.headers.location).to.equal('/sites');
        done();
      })
      .catch(done);
    });
  });


  describe('.contact', () => {
    it('renders the page properly', (done) => {
      request(app)
      .get('/contact')
      .expect(200)
      .then((response) => {
        expect(response.text.indexOf('contact')).to.be.above(-1);
        done();
      })
      .catch(done);
    });
  });

  describe('site wide error banner', () => {
    context('when an error is present', () => {
      beforeEach(() => {
        process.env.VCAP_SERVICES = JSON.stringify({
          'user-provided': [{
            credentials: { HEADING: 'Error message heading', BODY: 'Error message body' },
            name: 'federalist-site-wide-error',
          }],
        });
      });

      afterEach(() => {
        delete process.env.VCAP_SERVICES;
      });

      it('should display a banner for authenticated users', (done) => {
        authenticatedSession().then(cookie =>
          request(app)
            .get('/sites')
            .set('Cookie', cookie)
        )
        .then((response) => {
          expect(response.text).to.match(/usa-alert-warning/);
          expect(response.text).to.match(/Error message heading/);
          expect(response.text).to.match(/Error message body/);
          done();
        })
        .catch(done);
      });
    });

    context('when an error is not present', () => {
      it('should not display a banner for authenticated users', (done) => {
        authenticatedSession().then(cookie =>
          request(app)
            .get('/sites')
            .set('Cookie', cookie)
        )
        .then((response) => {
          expect(response.text).to.not.match(/usa-alert-warning/);
          done();
        })
        .catch(done);
      });

      it('should not display a banner for unauthenticated users', (done) => {
        request(app)
          .get('/site')
        .then((response) => {
          expect(response.text).to.not.match(/usa-alert-warning/);
          done();
        })
        .catch(done);
      });
    });
  });
});

describe('robots.txt', () => {
  const origAppConfig = Object.assign({}, config.app);

  after(() => {
    // reset config.app.app_env to its original value
    config.app = origAppConfig;
  });

  it('denies robots when not in production', (done) => {
    config.app.app_env = 'boop';

    request(app)
      .get('/robots.txt')
      .expect(200)
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .then((response) => {
        expect(response.text).to.equal('User-Agent: *\nDisallow: /\n');
        done();
      })
      .catch(done);
  });

  it('denies robots when in production but non-production hostname', (done) => {
    config.app.app_env = 'production';
    config.app.hostname = 'https://prod-url.com';

    request(app)
      .get('/robots.txt')
      .set('host', 'non-prod-url.com')
      .expect(200)
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .then((response) => {
        expect(response.text).to.equal('User-Agent: *\nDisallow: /\n');
        done();
      })
      .catch(done);
  });

  it('allows robots when in production and with production hostname', (done) => {
    config.app.app_env = 'production';
    config.app.hostname = 'https://prod-url.com';

    request(app)
      .get('/robots.txt')
      .set('host', 'prod-url.com')
      .expect(200)
      .expect('Content-Type', 'text/plain; charset=utf-8')
      .then((response) => {
        expect(response.text).to.equal('User-Agent: *\nDisallow: /preview\n');
        done();
      })
      .catch(done);
  });
});
