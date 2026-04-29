const asyncHandler = require('../../utils/asyncHandler');
const userService = require('./user.service');

const listStaff = asyncHandler(async (req, res) => {
  const users = await userService.listStaff();
  res.json(users);
});

const createStaff = asyncHandler(async (req, res) => {
  const user = await userService.createStaff(req.body);
  res.status(201).json(user);
});

const updateStaff = asyncHandler(async (req, res) => {
  const user = await userService.updateStaff(req.params.id, req.body);
  res.json(user);
});

const updateRole = asyncHandler(async (req, res) => {
  await userService.updateRole(req.params.id, req.body.role_id);
  res.json({ message: 'Role updated.' });
});

const toggleActive = asyncHandler(async (req, res) => {
  const result = await userService.toggleActive(req.params.id, req.body.is_active);
  res.json(result);
});

const deleteStaff = asyncHandler(async (req, res) => {
  await userService.deleteStaff(req.params.id);
  res.status(204).end();
});

module.exports = { listStaff, createStaff, updateStaff, updateRole, toggleActive, deleteStaff };
