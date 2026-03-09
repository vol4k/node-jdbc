import * as j from 'java'
import * as debug from 'debug'
import { execFileSync } from 'child_process'

import { EventEmitter } from 'events'
import { JavaAPI } from './types/JavaApi'
import { fromNodeCallback } from './utils/fromNodeCallback'

const java: JavaAPI = Object.assign(j, {
  newInstanceAsync (className: string, ...args: unknown[]) {
    return fromNodeCallback((callback) => j.newInstance(className, ...args, callback))
  },
  callStaticMethodAsync (className: string, methodName: string, ...args: unknown[]) {
    return fromNodeCallback((callback) => j.callStaticMethod(className, methodName, ...args, callback))
  }
})

let instance: Java = null

interface IMavenBootstrapResult {
  classpath: string[]
  dependencies: {}
}

export class Java {
  public java: JavaAPI
  public events: EventEmitter

  public mavenClasspath: string[] = []
  public mavenDependencies: {} = {}

  protected _debug: debug.IDebugger = debug('jdbc:Java')

  constructor (useXrs: boolean = true, useMaven: boolean = true) {
    if (instance) {
      return instance
    }

    instance = this

    this.java = java
    this.events = new EventEmitter()

    if (useXrs) {
      this._debug('use Xrs')
      this.addOption('-Xrs')
    }

    if (useMaven) {
      try {
        const deps = this.resolveMavenDependenciesSync()
        this.mavenClasspath = deps.classpath
        this.mavenDependencies = deps.dependencies
        this.addClasspath(this.mavenClasspath)
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          throw err
        } else {
          this._debug('node-java-maven not found. useMaven is ignored.')
        }
      }
    }

    return instance
  }

  static getInstance (): Java {
    if (!instance) {
      instance = new Java()
    }
    return instance
  }

  isJvmCreated (): boolean {
    return this.java.isJvmCreated()
  }

  addOption (option: string) {
    if (this.isJvmCreated() === false) {
      this.java.options.push(option)
    } else {
      throw new Error(`Can not add option '${option}', because JVM instance is already created`)
    }
  }

  addClasspath (dependencies: string[]) {
    if (this.isJvmCreated() === false) {
      this.java.classpath.push.apply(this.java.classpath, dependencies)
    } else {
      throw new Error(`Can not add classpath dependencies, because JVM instance is already created.\n\nDependencies: ${dependencies}`)
    }
  }

  private resolveMavenDependenciesSync (): IMavenBootstrapResult {
    const mvnPath = require.resolve('node-java-maven')
    try {
      const output = execFileSync(process.execPath, [
        '-e',
        `
          const mvn = require(process.argv[1])
          const marker = '__NODE_JDBC_MAVEN_RESULT__'
          mvn((err, deps) => {
            if (err) {
              process.stderr.write(marker + JSON.stringify({
                ok: false,
                error: {
                  message: err.message,
                  stack: err.stack,
                  code: err.code
                }
              }))
              process.exit(1)
              return
            }
            process.stdout.write(marker + JSON.stringify({
              ok: true,
              deps
            }))
          })
        `,
        mvnPath
      ], {
        cwd: process.cwd(),
        encoding: 'utf8'
      })

      return this.parseMavenBootstrapOutput(output)
    } catch (err) {
      return this.parseMavenBootstrapOutput(`${err.stdout || ''}${err.stderr || ''}`)
    }
  }

  private parseMavenBootstrapOutput (output: string): IMavenBootstrapResult {
    const marker = '__NODE_JDBC_MAVEN_RESULT__'
    const markerIndex = output.lastIndexOf(marker)

    if (markerIndex === -1) {
      throw new Error('Failed to resolve Maven dependencies synchronously: missing child process result marker')
    }

    const result = JSON.parse(output.slice(markerIndex + marker.length))

    if (result.ok !== true) {
      const error: Error & { code?: string } = new Error(result.error.message)
      error.stack = result.error.stack
      error.code = result.error.code
      throw error
    }

    return result.deps
  }
}
