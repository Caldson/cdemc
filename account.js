// 账号管理类
class AccountManager {
    constructor() {
        this.currentUser = null;
        this.loadCurrentUser();
    }

    // 登录/注册（如果用户不存在则自动创建）
    loginOrRegister(username, password) {
        const users = this.getAllUsers();
        
        // 如果用户不存在，自动创建
        if (!users[username]) {
            const confirmed = confirm("用户名不存在，将自动创建账号。\n\n注意：此系统使用本地存储，密码无法找回！\n\n确定要创建账号吗？");
            
            if (!confirmed) {
                return { success: false, message: "已取消创建账号" };
            }
            
            users[username] = {
                password: this.hashPassword(password),
                email: username + '@example.com',
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('cdbmc_users', JSON.stringify(users));
            
            this.currentUser = {
                username: username,
                email: users[username].email
            };
            localStorage.setItem('cdbmc_current_user', JSON.stringify(this.currentUser));
            alert('欢迎你的加入！')
            return { success: true, message: "账号创建并登录成功！" };
        }

        // 用户存在，验证密码
        if (users[username].password !== this.hashPassword(password)) {
            return { success: false, message: "密码错误" };
        }

        // 保存当前用户
        this.currentUser = {
            username: username,
            email: users[username].email
        };
        localStorage.setItem('cdbmc_current_user', JSON.stringify(this.currentUser));

        return { success: true, message: "登录成功！" };
    }

    // 登出
    logout() {
        this.currentUser = null;
        localStorage.removeItem('cdbmc_current_user');
    }

    // 检查是否登录
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // 获取当前用户
    getCurrentUser() {
        return this.currentUser;
    }

    // 获取所有用户
    getAllUsers() {
        const users = localStorage.getItem('cdbmc_users');
        return users ? JSON.parse(users) : {};
    }

    // 加载当前用户
    loadCurrentUser() {
        const user = localStorage.getItem('cdbmc_current_user');
        if (user) {
            this.currentUser = JSON.parse(user);
        }
    }

    // 密码哈希（简单版，生产环境应使用更安全的方法）
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }
}

// 使用示例
const accountManager = new AccountManager();

// 登录/注册
function loginOrRegisterUser() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert("请输入用户名和密码");
        return;
    }

    const result = accountManager.loginOrRegister(username, password);
    if (result.success) {
        alert(result.message);
        updateUI();
        if (typeof blackMidiSystem !== 'undefined') {
            blackMidiSystem.currentUser = accountManager.getCurrentUser();
            blackMidiSystem.loadVideos();
            blackMidiSystem.updatePublishFormVisibility();
        }
    } else {
        alert(result.message);
    }
}

// 登出
function logoutUser() {
    accountManager.logout();
    updateUI();
    if (typeof blackMidiSystem !== 'undefined') {
        blackMidiSystem.currentUser = null;
        blackMidiSystem.loadVideos();
        blackMidiSystem.updatePublishFormVisibility();
    }
}

// 注销账户
function deleteAccount() {
    if (!accountManager.isLoggedIn()) {
        alert('您还未登录！');
        return;
    }

    const user = accountManager.getCurrentUser();
    const password = prompt('请输入密码以注销账户：');

    if (password === null) {
        return;
    }

    const allUsers = accountManager.getAllUsers();
    const userData = allUsers[user.username];

    if (!userData || userData.password !== accountManager.hashPassword(password)) {
        alert('密码错误！');
        return;
    }

    const confirmLogout = confirm(`确定要注销账户"${user.username}"吗？此操作不可撤销！`);

    if (confirmLogout) {
        // 从用户列表中删除用户数据
        const allUsers = accountManager.getAllUsers();
        delete allUsers[user.username];
        localStorage.setItem('cdbmc_users', JSON.stringify(allUsers));

        accountManager.logout();
        updateUI();
        if (typeof blackMidiSystem !== 'undefined') {
            blackMidiSystem.currentUser = null;
            blackMidiSystem.loadVideos();
            blackMidiSystem.updatePublishFormVisibility();
        }
        alert('注销成功！');
    }
}

// 更新UI
function updateUI() {
    if (accountManager.isLoggedIn()) {
        const user = accountManager.getCurrentUser();
        document.getElementById('user_info').innerHTML = `欢迎，${user.username}`;
        document.getElementById('login_form').style.display = 'none';
        document.getElementById('logout_form').style.display = 'block';
    } else {
        document.getElementById('user_info').innerHTML = '未登录';
        document.getElementById('login_form').style.display = 'block';
        document.getElementById('logout_form').style.display = 'none';
    }
}

// 将函数暴露到全局作用域
window.loginOrRegisterUser = loginOrRegisterUser;
window.logoutUser = logoutUser;
window.deleteAccount = deleteAccount;
window.updateUI = updateUI;

function isLoggedIn() {
    return accountManager.isLoggedIn();
}
