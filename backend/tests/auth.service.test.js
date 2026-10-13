const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const AppError = require('../src/utils/AppError');

const staff = { id: 7, email: 'kitchen@example.com', first_name: 'Kitchen', last_name: 'Staff',
  role_name: 'manager', location_id: 2, is_active: 1 };
const secret = 'session-test-secret';

function setup(users = [staff]) {
  const deps = {
    jsonwebtoken: jwt, bcryptjs: { compare: async () => true },
    '../../config/db': { call: async () => [users] },
    '../../config/env': { jwt: { secret, expiresIn: '12h' } }, '../../utils/AppError': AppError,
  };
  const context = { module: { exports: {} }, require: (name) => deps[name] };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/modules/auth/auth.service'), 'utf8'), context);
  return context.module.exports;
}

test('kitchen renewal returns a signed 12-hour session with current permissions', async () => {
  const result = await setup().refreshStaffSession(7);
  const claims = jwt.verify(result.token, secret);
  assert.equal(claims.exp - claims.iat, 12 * 60 * 60);
  assert.equal(claims.role, 'manager');
  assert.equal(claims.location_id, 2);
  assert.equal(result.user.id, 7);
});

for (const [name, users] of [
  ['disabled', [{ ...staff, is_active: 0 }]],
  ['deleted', []],
  ['no longer staff', [{ ...staff, role_name: 'client' }]],
]) {
  test(`${name} accounts cannot renew sessions`, async () => {
    await assert.rejects(setup(users).refreshStaffSession(7), { statusCode: 401 });
  });
}

test('renewal uses changed role and location from database', async () => {
  const result = await setup([{ ...staff, role_name: 'admin', location_id: 3 }]).refreshStaffSession(7);
  const claims = jwt.verify(result.token, secret);
  assert.equal(claims.role, 'admin');
  assert.equal(claims.location_id, 3);
});

test('refresh authentication rejects expired tokens', () => {
  const context = { module: { exports: {} }, require: (name) => ({
    jsonwebtoken: jwt, '../config/env': { jwt: { secret } }, '../utils/AppError': AppError,
  })[name] };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/middleware/requireAuth'), 'utf8'), context);
  const token = jwt.sign({ user_id: 7, role: 'manager' }, secret, { expiresIn: -1 });
  context.module.exports({ headers: { authorization: `Bearer ${token}` } }, {}, (error) => {
    assert.equal(error.statusCode, 401);
  });
});
