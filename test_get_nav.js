// Emulate frontend getNav function with real DB settings
const mongoose = require('mongoose');
require('dotenv').config();

const dbUrl = process.env.DB_URL || 'mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test';
const adminSettingsModel = require("./models/superadmin/adminSettingsModel");

// Dummy allNav configuration exactly matching src/navigation/allNav.js
const ROLES = { SUPER_ADMIN: 'superadmin', ADMIN: 'admin' };
const allNav = [
  {
    id: 1,
    title: 'Executive Intelligence',
    role: ROLES.SUPER_ADMIN,
    children: [
      { id: 2, title: 'Executive Dashboard', path: '/admin/dashboard' },
      { id: 61, title: 'Intelligent System Logs', path: '/admin/dashboard/ai-logs', permission: 'wear.ai_logs' },
      { id: 62, title: 'Inventory Intelligence', path: '/admin/dashboard/ai-inventory', permission: 'wear.ai_inventory' }
    ]
  },
  {
    id: 200,
    title: 'Catalog & Taxonomy',
    role: ROLES.ADMIN,
    children: [
      { id: 30, title: 'Catalog Management', path: '/admin/dashboard/wear/catalog', permission: 'wear.catalog' },
      { id: 35, title: 'Taxonomy & Categories', path: '/admin/dashboard/wear/categories', permission: 'wear.categories' },
      { id: 37, title: 'Campaign Offers', path: '/admin/dashboard/wear/product-offers', permission: 'wear.product_offers' },
      { id: 38, title: 'Offer Zone', path: '/admin/dashboard/wear/offers', permission: 'wear.offers' }
    ]
  },
  {
    id: 300,
    title: 'Vendor Ecosystem',
    role: ROLES.ADMIN,
    children: [
      { id: 29, title: 'Vendor Ecosystem', path: '/admin/dashboard/wear/suppliers', permission: 'wear.suppliers' },
      { id: 39, title: 'Wear Locations', path: '/admin/dashboard/wear/locations', permission: 'wear.locations' },
      { id: 31, title: 'Marketing & Asset Control', path: '/admin/dashboard/wear/banners', permission: 'wear.banners' },
      { id: 41, title: 'Wear System Logs', path: '/admin/dashboard/wear/logs', permission: 'wear.logs' }
    ]
  },
  {
    id: 400,
    title: 'Order Fulfillment & Logistics',
    role: ROLES.ADMIN,
    children: [
      { id: 28, title: 'Order Fulfillment', path: '/admin/dashboard/wear/orders', permission: 'wear.orders' },
      { id: 40, title: 'Wear Buyers', path: '/admin/dashboard/wear/buyers', permission: 'wear.buyers' },
      {
        id: 99,
        title: 'Logistics Intelligence',
        permission: 'wear.shiprocket',
        children: [
          { id: 100, title: 'Financial Ledger', path: '/admin/dashboard/shiprocket/overview', permission: 'wear.shiprocket' },
          { id: 101, title: 'Shipment Tracking', path: '/admin/dashboard/shiprocket/orders', permission: 'wear.shiprocket' },
          { id: 102, title: 'Transaction History', path: '/admin/dashboard/shiprocket/transactions', permission: 'wear.shiprocket' }
        ]
      }
    ]
  },
  {
    id: 500,
    title: 'AI Security & Moderation',
    role: ROLES.ADMIN,
    children: [
      { id: 333, title: 'Fraud AI Intelligence', path: '/admin/dashboard/wear/fraud-assistant', permission: 'wear.ai_fraud' },
      { id: 32, title: 'Risk & Fraud Mitigation', path: '/admin/dashboard/wear/risk', permission: 'wear.risk' },
      { id: 331, title: 'Smart AI Moderation', path: '/admin/dashboard/wear/smart-reviews', permission: 'wear.ai_reviews' },
      { id: 332, title: 'Automated Support', path: '/admin/dashboard/wear/auto-support', permission: 'wear.ai_support' }
    ]
  },
  {
    id: 600,
    title: 'Financial & Platform Control',
    role: ROLES.ADMIN,
    children: [
      { id: 27, title: 'Financial Oversight', path: '/admin/dashboard/wear/finance', permission: 'wear.finance' },
      { id: 33, title: 'Operational Analytics', path: '/admin/dashboard/wear/analytics', permission: 'wear.analytics' },
      { id: 34, title: 'CRM Connectivity', path: '/admin/dashboard/wear/whatsapp', permission: 'wear.whatsapp' },
      { id: 5, title: 'Sub-Admins & Managers', path: '/admin/dashboard/sub-admins', role: ROLES.SUPER_ADMIN },
      { id: 20, title: 'Platform Settings', path: '/admin/dashboard/settings', role: ROLES.SUPER_ADMIN }
    ]
  }
];

const kkkPermissions = [
  "wear.ai_inventory",
  "wear.ai_logs",
  "wear.orders",
  "wear.catalog",
  "wear.finance",
  "wear.suppliers",
  "wear.banners",
  "wear.risk",
  "wear.analytics",
  "wear.ai_reviews",
  "wear.ai_fraud",
  "wear.categories",
  "wear.whatsapp",
  "wear.ai_support",
  "wear.settings",
  "wear.offers",
  "wear.buyers",
  "wear.shiprocket",
  "product.add",
  "product.inventory",
  "orders.access",
  "payments.history",
  "payments.methods",
  "chat.support",
  "store.profile",
  "setting.store",
  "setting.notifications",
  "wear.reviews",
  "setting.security",
  "setting.personal",
  "chat.broadcast",
  "chat.customer",
  "payments.withdraw",
  "analytics.users",
  "product.reviews",
  "product.all",
  "dashboard.access",
  "wear.logs",
  "wear.locations",
  "wear.product_offers"
];

function getNav(role, permissions = [], menuDisplaySettings = {}, pathname = '') {
  const finalNavs = [];

  for (let i = 0; i < allNav.length; i++) {
    const item = allNav[i];
    const isSuperAdmin = role === 'superadmin';
    const roleMatch = role === item.role || (isSuperAdmin && item.role === 'admin');
    const permissionMatch = item.permission && permissions && permissions.includes(item.permission);

    const merchantMenuIds = [9, 10, 15, 126, 24, 28, 32, 33, 57];
    const isStaffPortal = pathname.startsWith('/admin/dashboard');
    if ((isSuperAdmin || isStaffPortal) && merchantMenuIds.includes(item.id)) {
      continue;
    }

    if (roleMatch || permissionMatch) {
      if (isSuperAdmin) {
        finalNavs.push(item);
        continue;
      }

      if (item.children && item.children.length > 0) {
        const filteredChildren = item.children.filter(child => {
          if (child.role === 'superadmin' && !isSuperAdmin) {
            return false;
          }
          if (child.permission) {
            return permissions && permissions.includes(child.permission);
          }
          return true;
        });

        if (filteredChildren.length > 0) {
          const menuKey = item.id.toString();
          const displayMode = menuDisplaySettings[menuKey] || 'grouped';

          if (displayMode === 'flat') {
            finalNavs.push(...filteredChildren);
          } else {
            finalNavs.push({
              ...item,
              children: filteredChildren
            });
          }
        }
      } else {
        let hasParentPermission = true;
        if (item.permission && (!permissions || !permissions.includes(item.permission))) {
          hasParentPermission = false;
        }

        if (hasParentPermission) {
          finalNavs.push(item);
        }
      }
    }
  }
  return finalNavs;
}

async function run() {
    await mongoose.connect(dbUrl);
    const dbSettings = await adminSettingsModel.findOne({ settingKey: 'menuDisplayMode' }).lean();
    const menuDisplaySettings = dbSettings?.settingValue || {};
    console.log("Using menuDisplaySettings from DB:", menuDisplaySettings);

    const navs = getNav('admin', kkkPermissions, menuDisplaySettings, '/admin/dashboard/wear/buyers');
    console.log("Emulated Sidebar navigation structure:");
    console.log(JSON.stringify(navs.map(n => ({
        id: n.id,
        title: n.title,
        hasChildren: !!(n.children && n.children.length > 0),
        children: n.children ? n.children.map(c => ({ id: c.id, title: c.title })) : null
    })), null, 2));

    await mongoose.disconnect();
}

run();
