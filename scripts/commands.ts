import { ChildProcess, exec, ExecOptions, spawn, SpawnOptions } from 'child_process';
import * as path from 'path';

function childProcessToPromise(child: ChildProcess) {
    return new Promise<void>((resolve, reject) => {
        child.on('close', code => {
            if(code) {
                reject(new Error(`Process exited with error: ${code}`));
            } else {
                resolve();
            }
        });
        child.on('error', reason => {
            reject(reason);
        });
    });
}

function runCommand(command: string, args: string[] = [], options: SpawnOptions = {}) {
    return childProcessToPromise(spawn(command, args, {
        stdio: 'inherit',
        ...options
    }));
}

function runScript(script: string, options: ExecOptions = {}) {
    console.log('$ %s', script);
    const child = exec(script, {
        ...options
    })
    if(child.stderr) {
        child.stderr.pipe(process.stderr);
    }
    if(child.stdout) {
        child.stdout.pipe(process.stdout);
    }
    return childProcessToPromise(child);
}

const dest = path.resolve(__dirname,'../dist');

async function test() {
    await runCommand(
        'npx',
        [
            'sarg',
            '--require', 'ts-node/register',
            '--bail',
            path.resolve(__dirname,'../test/**/*.{ts,tsx}')
        ],
        {
            env: {
                ...process.env,
                TS_NODE_PROJECT: path.resolve(__dirname,'../test/tsconfig.json'),
            }
        }
    );
}

async function release() {
    const libFolder = path.resolve(__dirname,'../lib/src');
    await test();
    await runScript(`
        npx tsc \
            -b ${path.resolve(__dirname,'../test')} && \
        rm -rfv ${dest} && \
        mkdir -pv ${dest} && \
        npx babel \
            --config-file ${path.resolve(__dirname,'../.babelrc')} \
            ${libFolder} \
            -Dd ${dest} && \
        cp -v \
            ${path.resolve(__dirname,'../package.json')} \
            ${dest}
    `);
}

async function run() {
    for(const arg of process.argv) {
        switch(arg) {
            case '--release':
                await release();
                break;
            case '--publish':
                await test();
                await release();
                await runScript(`
                    cd ${dest} && \
                    npm publish
                `);
                break;
            case '--test':
                await test();
                break;
        }
    }
}

run().catch(reason => {
    console.error(reason);
    process.exitCode = 1;
})
