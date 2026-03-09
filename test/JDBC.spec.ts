import * as should from 'should'

import {Connection} from '../src/Connection'
import {JDBC} from '../src/JDBC'

describe('JDBC', () => {
  it('should register h2 driver', () => {
    new JDBC({
      className: 'org.h2.Driver',
      url: 'jdbc:h2:mem:test'
    })
  })

  it('should connect to h2 memory database', () => {
    const jdbc = new JDBC({
      className: 'org.h2.Driver',
      url: 'jdbc:h2:mem:test'
    })

    return jdbc.getConnection()
      .then((connection: Connection) => {
        should.exist(connection)
      })
  })

  it('should create and execute a statement', async () => {
    const jdbc = new JDBC({
      className: 'org.h2.Driver',
      url: 'jdbc:h2:mem:test'
    })

    const statement = await jdbc.createStatement()
    await statement.executeUpdate(`
      CREATE TABLE jdbc_test_table (
        id int not null
      )
    `)

    const result = await statement.executeUpdate(`
      INSERT INTO jdbc_test_table (id) VALUES
      (1),
      (2)
    `)

    result.should.be.equal(2)

    const result2 = await statement.executeQuery(`
        SELECT * FROM jdbc_test_table
    `)

    const resultSet = result2.fetchAllResults()
    resultSet.should.have.length(2)
  })

  it('should register the same driver only once', async () => {
    const config = {
      className: 'example.cached.Driver',
      url: 'jdbc:h2:mem:test'
    }

    const jdbc1 = new JDBC(config) as any
    const jdbc2 = new JDBC(config) as any
    let classForNameCalls = 0
    let registerCalls = 0

    jdbc1.classForName = async () => {
      classForNameCalls += 1
      return { driver: 'first' }
    }
    jdbc1.registerDriver = async () => {
      registerCalls += 1
    }
    jdbc2.classForName = async () => {
      classForNameCalls += 1
      return { driver: 'second' }
    }
    jdbc2.registerDriver = async () => {
      registerCalls += 1
    }

    await jdbc1.init()
    await jdbc2.init()

    classForNameCalls.should.be.equal(1)
    registerCalls.should.be.equal(1)
  })
})
