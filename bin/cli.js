#!/usr/bin/env node

'use strict';

const get = require('lodash.get');
const fs = require('fs');
const path = require('path');
const colors = require('colors/safe');
const yaml = require('js-yaml');
const prompt = require('prompt');
const program = require('commander');

const baseDir = process.cwd();
const kesFolder = path.join(baseDir, '.kes');
require('./readme');

const success = (r) => process.exit(0);

/**
 * @name failure
 * @private
 */
const failure = (e) => {
  console.log(e);
  if (e.message) {
    console.log(e.message);
  }
  else {
    console.log(e);
  }
  process.exit(1);
};

const init = function () {
  if (fs.existsSync(kesFolder)) {
    console.log('.kes folder already exists!');
    process.exit(1);
  }

  const promptSchema = {
    properties: {
      stack: {
        message: colors.white('Name the CloudFormation stack:'),
        default: 'kes-cf-template'
      },
      stage: {
        message: colors.white('Name the deployment stage:'),
        default: 'dev'
      },
      bucket: {
        message: colors.white('Bucket name used for deployment (required):'),
        required: true
      }
    }
  };

  prompt.get(promptSchema, function (err, result) {
    if (err) {
      console.log(err);
      process.exit(1);
    }

    console.log(kesFolder);
    fs.mkdirSync(kesFolder);
    fs.mkdirSync(path.join(baseDir, 'dist'));
    console.log(`.kes folder created at ${kesFolder}`);

    // copy simple config file and template
    const config = yaml.safeLoad(fs.readFileSync(
      path.join(__dirname, '..', 'examples/lambdas/config.yml'), 'utf8'));
    config.stackName = result.stack;
    config.stage = result.stage;
    config.buckets.internal = result.bucket;
    fs.writeFileSync(path.join(kesFolder, 'config.yml'), yaml.safeDump(config));

    fs.createReadStream(
      path.join(__dirname, '..', 'examples/lambdas/cloudformation.template.yml')
    ).pipe(fs.createWriteStream(path.join(kesFolder, 'cloudformation.template.yml')));
    console.log('config files were copied');
  });
};

//const configureProgram = function () {
program
  .usage('init')
  .description('Start a Kes project')
  .action(() => {
    init();
  });

// the CLI activation
program
  .usage('TYPE COMMAND [options]')
  .option('-p, --profile <profile>', 'AWS profile name to use for authentication', null)
  .option('-c, --config <config>', 'Path to config file')
  .option('--stage-file <stageFile>', 'Path to config file')
  .option('--env-file <envFile>', 'Path to env file')
  .option('--cf-file <cfFile>', 'Path to CloudFormation template')
  .option('--kes-class <kesClass>', 'Kes Class override', null)
  .option('-k, --kes-folder <kesFolder>', 'Path to config folder')
  .option('-r, --region <region>', 'AWS region', 'us-east-1')
  .option('--stack <stack>', 'stack name, defaults to the config value')
  .option('--stage <stage>', 'stage name, defaults to the config value');

program
  .command('cf [create|update|validate|compile]')
  .description(`CloudFormation Operations:
  create    Creates the CF stack
  update    Updates the CF stack
  validate  Validates the CF stack
  compile   Compiles the CF stack`)
  .action((cmd) => {
    let Kes;
    const kesClass = get(program, 'kesClass');
    if (kesClass) {
      Kes = require(path.join(process.cwd(), kesClass));
    }
    else {
      Kes = require('../index').Kes;
    }

    const kes = new Kes(program);
    switch (cmd) {
      case 'create':
        kes.createStack().then(r => success(r)).catch(e => failure(e));
        break;
      case 'update':
        kes.updateStack().then(r => success(r)).catch(e => failure(e));
        break;
      case 'validate':
        kes.validateTemplate().then(r => success(r)).catch(e => failure(e));
        break;
      case 'compile':
        kes.compileCF().then(r => success(r)).catch(e => failure(e));
        break;
      default:
        console.log('Wrong choice. Accepted arguments: [create|update|validate|compile|dlq]');
    }
  });

program
  .command('lambda <lambdaName>')
  .description('uploads a given lambda function to Lambda service')
  .action((cmd, options) => {
    if (cmd) {
      const Kes = require('../index').Kes;
      const kes = new Kes(program);
      kes.updateSingleLambda(cmd).then(r => success(r)).catch(e => failure(e));
    }
    else {
      console.log('Lambda name is missing');
    }
  });

program
  .parse(process.argv);
