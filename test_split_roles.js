// Mock of the frontend allNav array
const allNav = [
    {
        id: 5,
        title: 'Sub-Admins & Managers',
        path: '/admin/dashboard/sub-admins',
        role: 'admin',
        isAdminMenu: true,
        isSuperAdminOnly: true,
        permission: 'subadmins.manage'
    },
    {
        id: 20,
        title: 'Platform Settings',
        path: '/admin/dashboard/settings',
        role: 'admin',
        isAdminMenu: true,
        isSuperAdminOnly: true,
        permission: 'settings.manage'
    },
    {
        id: 104,
        title: 'AI Logic & Forecasts',
        role: 'admin',
        children: [
            {
                id: 105,
                title: 'AI Forecasts',
                path: '/admin/dashboard/ai-inventory',
                role: 'admin',
                permission: 'wear.ai_inventory'
            },
            {
                id: 106,
                title: 'AI Risk & Fraud',
                path: '/admin/dashboard/wear/risk',
                role: 'admin',
                permission: 'wear.risk'
            }
        ]
    },
    {
        id: 120,
        title: 'Catalog',
        role: 'admin',
        children: [
            {
                id: 121,
                title: 'Products',
                path: '/admin/dashboard/products',
                role: 'admin',
                permission: 'wear.products'
            }
        ]
    }
];

// Replicate the frontend getNav logic
function getNav(role, permissions = []) {
    const finalNavs = [];
    const activeNav = allNav;

    const isSuperAdmin = role === 'admin';
    const isSubAdmin = role === 'manager';

    for (let i = 0; i < activeNav.length; i++) {
        const item = activeNav[i];

        // Super Admin ONLY sees manager-management menus (isSuperAdminOnly: true)
        if (isSuperAdmin) {
            if (item.isSuperAdminOnly) {
                finalNavs.push(item);
            }
            continue;
        }

        // Sub-Admins NEVER see isSuperAdminOnly menus.
        if (item.isSuperAdminOnly) continue;

        if (item.children && item.children.length > 0) {
            const filteredChildren = item.children.filter(child => {
                if (child.permission) {
                    return permissions.includes(child.permission);
                }
                return true;
            });

            if (filteredChildren.length > 0) {
                // Return a deep copy so we don't mutate the original for subsequent tests
                finalNavs.push({ ...item, children: filteredChildren });
            }
        } else {
            if (item.permission) {
                if (permissions.includes(item.permission)) {
                    finalNavs.push(item);
                }
            }
        }
    }

    return finalNavs;
}

// ==========================================
// TEST 1: LOGIN AS SUPER ADMIN (role: 'admin')
// ==========================================
console.log('--- TEST 1: SUPER ADMIN LOGIN (role: admin) ---');
const superAdminNavs = getNav('admin', []); // Super admins don't need permissions array
console.log(`Menus Loaded (${superAdminNavs.length}):`);
superAdminNavs.forEach(nav => {
    console.log(`  - ${nav.title} (isSuperAdminOnly: ${nav.isSuperAdminOnly})`);
    if (nav.children) {
        nav.children.forEach(child => console.log(`      └─ ${child.title}`));
    }
});
console.log('');

// ==========================================
// TEST 2: LOGIN AS MANAGER (role: 'manager')
// ==========================================
console.log('--- TEST 2: MANAGER LOGIN (role: manager) ---');
// Mocking the permissions array for a manager (e.g., 'kkk' from previous screenshots)
const managerPermissions = [
    'wear.ai_inventory',
    'wear.products'
];

const managerNavs = getNav('manager', managerPermissions);
console.log(`Menus Loaded (${managerNavs.length}):`);
managerNavs.forEach(nav => {
    console.log(`  - ${nav.title}`);
    if (nav.children) {
        nav.children.forEach(child => console.log(`      └─ ${child.title} (Requires: ${child.permission})`));
    }
});
console.log('');

console.log('--- TEST SUMMARY ---');
console.log('Are there any overlaps? ', superAdminNavs.some(n => managerNavs.find(m => m.id === n.id)) ? 'YES (Error)' : 'NO (Perfect split)');
