# 云盘备份配置指南（Google Drive / OneDrive）

Trakt Dashboard 的数据库备份支持四种目标：**WebDAV、S3 兼容存储、Google Drive、OneDrive**。

- **WebDAV / S3** 开箱即用——在 设置 → 备份 页填入服务器地址与凭据即可（自托管场景推荐，
  例如备份到 NAS 自带的 WebDAV 服务或 MinIO）。
- **Google Drive / OneDrive** 使用 OAuth 设备授权流（Device Flow），需要你**自己注册一个
  OAuth 应用**并把凭据配置到环境变量。未配置时，设置页会隐藏对应卡片并显示"备份已禁用"
  提示——这是预期行为，不是故障。

本文档说明如何注册应用、拿到凭据、完成配置。

---

## 为什么需要自备凭据？

设备授权流要求一个"应用身份"（client id）。公共项目如果内置一份共享凭据，等于把配额和
安全边界交给所有部署者共用，且 Google/Microsoft 的审核政策也不允许。自托管项目的惯例
（rclone、restic 等同理）是每个部署者注册自己的应用——免费、一次性、约 10 分钟。

---

## Google Drive

### 1. 创建 Google Cloud 项目并启用 Drive API

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)，创建一个新项目
   （名字随意，如 `trakt-dashboard-backup`）。
2. 左侧菜单 → **API 和服务 → 库**，搜索 **Google Drive API**，点击**启用**。

### 2. 配置 OAuth 同意屏幕

1. **API 和服务 → OAuth 同意屏幕**：
    - User Type 选 **外部（External）**（个人账号唯一选项）。
    - 应用名称、支持邮箱随意填写。
    - 范围（Scopes）这一步可跳过——设备流会在授权时动态请求 `drive.file`。
2. **测试用户**：把你自己的 Google 账号加入测试用户列表。
    > 应用保持"测试"状态即可，无需提交审核。注意：测试状态下 refresh token 有效期为
    > 7 天（Google 政策）；若想长期有效，可在同意屏幕点击"发布应用"（Publish App），
    > 未验证应用会有警告页但个人使用可继续。

### 3. 创建 OAuth 客户端（关键：类型选"电视和受限输入设备"）

1. **API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID**。
2. 应用类型选择 **电视和受限输入设备（TVs and Limited Input devices）**——设备授权流
   只有这个类型支持。
3. 创建后得到 **客户端 ID**（形如 `xxxx.apps.googleusercontent.com`）和**客户端密钥**。

> 本项目使用 `https://www.googleapis.com/auth/drive.file` 范围（仅能访问应用自己创建的
> 文件），它在 Google 设备流的允许范围列表内。备份文件存放在你云盘的
> `MediaDashBackups/` 目录。

### 4. 配置环境变量

在部署目录的 `.env`（或 docker-compose 的环境变量）中加入：

```bash
GDRIVE_CLIENT_ID=xxxx.apps.googleusercontent.com
GDRIVE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
```

重启 API 容器后，设置 → 备份 页会出现 Google Drive 卡片，点击**连接**，按提示访问
验证链接并输入代码完成授权。

---

## OneDrive

### 1. 注册 Azure 应用

1. 打开 [Azure Portal — 应用注册](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)，
   点击**新注册**。
2. 名称随意（如 `trakt-dashboard-backup`）；**受支持的账户类型**选
   **任何组织目录中的账户和个人 Microsoft 账户**（即 common 租户）。
3. 重定向 URI **留空**（设备流不需要）。

### 2. 允许公共客户端流

1. 进入刚创建的应用 → **身份验证（Authentication）**。
2. 底部 **高级设置 → 允许公共客户端流（Allow public client flows）** 切换为 **是**——
   设备授权流必须开启此项。

### 3. API 权限

1. **API 权限 → 添加权限 → Microsoft Graph → 委托的权限**。
2. 勾选 **Files.ReadWrite** 与 **offline_access**（后者用于 refresh token）。
   个人账户无需管理员同意。

### 4. 配置环境变量

应用概览页的**应用程序(客户端) ID** 即所需凭据（OneDrive 设备流是公共客户端，
**不需要**密钥）：

```bash
ONEDRIVE_CLIENT_ID=00000000-0000-0000-0000-000000000000
```

重启 API 容器后，在设置 → 备份 页点击 OneDrive 的**连接**完成设备授权。备份文件
存放在 OneDrive 的 `MediaDashBackups/` 目录。

---

## 常见问题

| 现象                                      | 原因与处理                                                            |
| ----------------------------------------- | --------------------------------------------------------------------- |
| 设置页看不到 Google Drive / OneDrive 卡片 | 对应环境变量未配置（这正是本文要解决的）；配置后需重启 API            |
| GDrive 授权 7 天后失效                    | Google 项目处于"测试"状态时 refresh token 只有 7 天，见上文"发布应用" |
| GDrive 报 `access_denied`                 | 你的账号不在 OAuth 同意屏幕的测试用户列表里                           |
| OneDrive 报 `invalid_client`              | "允许公共客户端流"未开启                                              |
| 不想折腾 OAuth                            | 用 WebDAV 或 S3——功能完全一致，配置只要一分钟                         |
