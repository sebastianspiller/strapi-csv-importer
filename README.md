# Strapi Import

This is an import helper package to easily import data to strapi via graph ql api, written in typescript.

## Usage

- npm install
- edit .env.example to .env and add corresponding values
- in strapi, create a privileged user with a role, which can create datasets in the corresponding collections
- add your csv in csv-folder; columns and types (i.e. string, number) must correspond with strapi collection
