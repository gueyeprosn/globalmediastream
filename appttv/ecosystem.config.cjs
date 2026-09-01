module.exports = {
  apps: [
    {
      name: "touba-appttv",
      script: "dist/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 3010,
        BASE_PATH: "/appttv",
        PUBLIC_BASE_URL: "https://stream.broadcastsn.com/appttv",
      },
    },
  ],
};
