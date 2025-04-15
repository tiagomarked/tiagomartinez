require("dotenv").config({ "path": "scripts/deploy.env" });

const FtpDeploy = require("ftp-deploy");
const ftpDeploy = new FtpDeploy();

const config = {
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    host: process.env.FTP_HOST,
    port: process.env.FTP_PORT,
    localRoot: __dirname + "/../dist",
    remoteRoot: process.env.FTP_REMOTE_PATH,
    include: ["*", "**/*"],
    deleteRemote: true,
};

ftpDeploy
    .deploy(config)
    .then(res => console.log("Deployed:", res))
    .catch(err => console.error("Error:", err));
