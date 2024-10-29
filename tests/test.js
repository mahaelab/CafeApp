const request = require('supertest');
const app = require('../server.js');

describe('Integration Test for Express Server', () => {
    it('GET / should return the landing page with status 200', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
    });
});
