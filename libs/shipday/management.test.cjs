const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Compile the TS file on the fly to require it
const tsPath = path.join(__dirname, 'management.ts');
execSync(`npx tsc ${tsPath} --target es2022 --module commonjs --skipLibCheck`);
const { getShipdayManagementClient, getDeliveryStoreAddress } = require('./management.js');

test('Shipday Management Client', async (t) => {
  const originalFetch = global.fetch;
  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  await t.test('listOrders uses correct url, cursor and authorization', async () => {
    global.fetch = async (url, options) => {
      assert.ok(url.includes('/orders/query?cursor=2'), 'cursor appended correctly');
      assert.strictEqual(options.headers['Authorization'], 'Basic ');
      
      return {
        ok: true,
        json: async () => ({
          orders: [
            { orderId: 123, orderNumber: 'REF-1', orderStatus: { orderState: 'ACTIVE' } },
            { orderId: 124, orderNumber: 'REF-2', orderStatus: { orderState: 'COMPLETED' } }
          ],
          nextCursor: 'abc'
        })
      };
    };

    const client = getShipdayManagementClient();
    const result = await client.listOrders({ status: 'ACTIVE', from: 'time1', to: 'time2', page: 2 });
    assert.strictEqual(result.orders.length, 1);
    assert.strictEqual(result.orders[0].id, '123');
    assert.strictEqual(result.orders[0].reference, 'REF-1');
    assert.strictEqual(result.hasMore, true);
    assert.strictEqual(result.page, 2);
  });

  await t.test('createOrder sends correct mapped address and references', async () => {
    let requestBody = null;
    global.fetch = async (url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ orderId: 999 })
      };
    };

    const client = getShipdayManagementClient();
    const result = await client.createOrder({
      reference: 'ORDER-123',
      address: {
        address_line1: '1 Main St',
        city: 'Sydney',
        state: 'NSW',
        postcode: '2000'
      },
      recipient: {
        name: 'John Doe',
        phone: '555-1234'
      }
    });

    assert.strictEqual(result, '999');
    assert.strictEqual(requestBody.orderNumber, 'ORDER-123');
    assert.strictEqual(requestBody.customerName, 'John Doe');
    assert.strictEqual(requestBody.customerAddress, '1 Main St, Sydney, NSW, 2000');
  });

  await t.test('createOrder rejects on failure', async () => {
    global.fetch = async () => ({
      ok: false,
      statusText: 'Bad Request',
      text: async () => 'Invalid address'
    });
    
    const client = getShipdayManagementClient();
    await assert.rejects(client.createOrder({
      reference: 'ORDER-123',
      address: { address_line1: '1', city: 'S', state: 'N', postcode: '2' },
      recipient: { name: 'J', phone: '1' }
    }), /Invalid address/);
  });
  
  await t.test('assignDelivery explicit assignment', async () => {
    global.fetch = async (url, options) => {
      assert.ok(url.endsWith('/on-demand/assign'));
      const body = JSON.parse(options.body);
      assert.strictEqual(body.orderId, 123);
      assert.strictEqual(body.estimateReference, 'est-abc');
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    };
    
    const client = getShipdayManagementClient();
    const result = await client.assignDelivery('123', {
      id: 'est-abc',
      provider: 'Uber',
      fee: 10,
      currency: 'AUD',
      pickupAt: null, deliveryAt: null, pickupMinutes: null, deliveryMinutes: null
    });
    
    assert.strictEqual(result.success, true);
  });

});

