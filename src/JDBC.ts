import * as debug from 'debug'
import * as BluebirdPromise from 'bluebird'

import { isEmpty } from 'lodash'
import { Connection, IConnection } from './Connection'
import { Java } from './Java'
import { Statement } from './Statement'

export interface IJDBCConfig {
  className: string
  url: string
  username?: string
  password?: string
}

const registeredDrivers: Map<string, any> = new Map();

export class JDBC {
  private connection: BluebirdPromise<Connection>
  private config: IJDBCConfig

  private debug: debug.IDebugger = debug('@naxmefy/jdbc')

  constructor (config: IJDBCConfig) {
    this.config = config
    this.validateConfig()
    this.debug('setup jdbc instance for', this.config.className)
  }

  async init(): Promise<any> {
    if (!registeredDrivers.has(this.config.className)) {
      this.debug('setup jdbc instance for', this.config.className)
      const driver: any = await this.classForName()
      await this.registerDriver(driver)
      registeredDrivers.set(this.config.className, driver)
    }
  }

  getConnection (connectIfClosed?: boolean): BluebirdPromise<Connection> {
    if (!this.connection) {
      return this.connection = this.newConnection()
    }

    return this.connection.then((connection: Connection) => {
      if (connection.isClosed() && connectIfClosed) {
        return this.connection = this.newConnection()
      }

      return connection
    })
  }

  createStatement (connectIfClosed?: boolean): BluebirdPromise<Statement> {
    return this.getConnection(connectIfClosed)
      .then((connection: Connection) => connection.createStatement())
  }

  private validateConfig (): void {
    if (isEmpty(this.config.className)) {
      throw new Error('Missing driver class')
    }
  }

  private classForName (): Promise<any> {
    this.debug('generate new java instance for driver', this.config.className)
    return Java.getInstance().java.newInstanceAsync(this.config.className)
  }

  private registerDriver (driver: any): Promise<any> {
    this.debug('register jdbc driver', this.config.className)
    return Java.getInstance().java.callStaticMethodAsync('java.sql.DriverManager', 'registerDriver', driver)
  }

  private newConnection (): BluebirdPromise<Connection> {
    return Java.getInstance().java.callStaticMethodAsync(
      'java.sql.DriverManager',
      'getConnection',
      this.config.url,
      this.config.username || null,
      this.config.password || null
    )
      .then((connection: IConnection) => new Connection(connection))
  }
}
