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

const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.params.id, req.body.password);
  res.json({ message: 'Password updated.' });
});

const toggleActive = asyncHandler(async (req, res) => {
  const result = await userService.toggleActive(req.params.id, req.body.is_active);
  res.json(result);
});

const deleteStaff = asyncHandler(async (req, res) => {
  await userService.deleteStaff(req.params.id);
  res.status(204).end();
});

// --- Clients directory (admin) -------------------------------------------
const listClients = asyncHandler(async (req, res) => {
  const clients = await userService.listClients(req.query.search);
  res.json(clients);
});

const getClientOrders = asyncHandler(async (req, res) => {
  const client = await userService.getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found.' });
  const orders = await userService.getClientOrders(req.params.id);
  res.json({ client, orders });
});

module.exports = {
  listStaff, createStaff, updateStaff, updateRole, changePassword,
  toggleActive, deleteStaff,
  listClients, getClientOrders,
};
