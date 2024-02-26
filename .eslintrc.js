module.exports = {
    "env": {
        "es2022": true
    },
    "root": true,
    "extends": "standard-with-typescript",
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module",
        "tsconfigRootDir": ".",
        "project": "./tsconfig.json"
    },
    "plugins": ["@typescript-eslint"],
    "rules": {
    }
}
