import {
    Canister,
    ic,
    Opt,
    query,
    Record,
    StableBTreeMap,
    text,
    blob,
    update,
    Vec,
    Result,
    nat64,
    int8,
    Err,
    bool,
    Principal,
    Variant,
    Ok,
    None,
    Some,
    Void,

} from 'azle';





const Order= Record({
    id: Principal,
    productName: text,
    price: nat64,
    buyer: Principal,
    seller: Principal,
    paid: bool,
    Delivered: bool,
    uniqueNumber: Principal
})
const orderPayload = Record({
    buyer: Principal,
    productName: text,
    price: nat64,
})

const orderStorage = StableBTreeMap(Principal, Order,0)
const accounts = StableBTreeMap(Principal, nat64,1)
const OrderToUser = StableBTreeMap(Principal, Vec(Order),2)
const Error = Variant({
    OrderDoesNotExist: Principal,
    NotTheBuyer: Principal,
    OderPaidorDelivered: Principal,
    Error: Principal,
    insufficientBalance: Principal,
    invalidUniqueNumber: text,
    NoFunds: Principal
   
});

export default Canister({
    createOrder: update([orderPayload],Order,(payload)=>{
       
        const id = generateId()
        const oodd= OrderToUser.get(id)

        const order: typeof Order= {
            id: id,
            ...payload,
            paid: false,
            Delivered: false,
            uniqueNumber: Principal.fromUint8Array(new Uint8Array(0)),
            seller: ic.caller()
        }
         // Get the existing vector or create a new one
         const existingOrders = OrderToUser.get(ic.caller());
         const ordersToInsert = existingOrders.isSome ? existingOrders.unwrap() : [];
 
         // Push the new order into the vector
         ordersToInsert.push(order);
         const buyeracct = accounts.get(order.buyer)
         const selleracct = accounts.get(order.seller)
         if('None' in buyeracct){
            accounts.insert(order.buyer, 10000n)
        }
        if('None' in selleracct){
            accounts.insert(order.seller, 10000n)
        }
        orderStorage.insert(order.id, order)

        OrderToUser.insert(ic.caller(), ordersToInsert)
       
       
        return order;
    }),
    // resets token to 10000
    MintTokens: update([], Result(nat64, Error), ()=>{
        const acct = accounts.get(ic.caller())
        const a = acct.Some
        if('None' in acct){
            return Err({
                Error: ic.caller()
            })
        }
        
        accounts.insert(ic.caller(),10000n)
        return Ok(10000n)
    }),
    // getExistingOrders: query([],Result(Vec(Order),Error),()=>{
    //     const callerPrincipal = ic.caller();
    // const allOrders = OrderToUser.get(callerPrincipal);
   

    // if ('None' in allOrders) {
    //     return Err({
    //         Error: "No existing orders for the user",
    //     });
    // }

    // const userOrders = allOrders.unwrap().filter(order => order.buyer.toString() === callerPrincipal.toString());

    // if (userOrders.length === 0) {
    //     return Err({
    //         Error: "No existing orders for the user as a buyer",
    //     });
    // }

    // return Ok(userOrders);
    // }),
    PayForOrder: update([Principal], Result(Order, Error),(id)=>{
        
        const orderOpt = orderStorage.get(id)
        const acct = accounts.get(ic.caller())

        if( 'None' in acct){
            return Err({
                NoFunds: id
            })
        }
        if( 'None' in orderOpt){
            return Err({
                OrderDoesNotExist: id
            })
        }
        
        const order = orderOpt.Some
        if(order.buyer.toString() != ic.caller().toString()){
            return Err({
                NotTheBuyer: id
            })
        }
        if(order.paid != false && order.Delivered != false ){
            return Err({
                OderPaidorDelivered: ic.caller()
            })
        }
        const from = ic.caller();

        const fromBalance = getBalance(accounts.get(from));

        if (order.amount > fromBalance) {
           return Err({
            insufficientBalance: ic.caller()
           })
        }

        const toBalance = getBalance(accounts.get(order.seller));

        accounts.insert(from, fromBalance - order.price);
        accounts.insert(order.seller, toBalance + order.price);

      
       const uniqueNumber = generateId()
        const ods: typeof Order = {
            ...order,
            paid: true,
            uniqueNumber: uniqueNumber
        }
        
        return Ok(ods)
        
        
    }),

    getAcctBalance: query([],nat64, ()=>{
        const act = accounts.get(ic.caller())
       
        if ('None' in act){
            console.log("no acct")
        }
        return act.Some
    }),

    getUniqueNumber: query([Principal],Result(Principal,Error),(id)=>{
    const orderOpt = orderStorage.get(id);
    if ('None' in orderOpt) {
        return Err({
            OrderDoesNotExist: id,
        });
    }

    const order = orderOpt.Some;

    // Ensure the caller is the buyer of the order
    if (ic.caller().toString() != order.buyer.toString()) {
        return Err({
            NotTheBuyer: id,
        });
    }
    if(order.paid != true){
        return Err({
            Error: id
        })
    }

    // Return the unique number associated with the order
    return Ok(order.uniqueNumber);
    }),

    getAllOrders: query([], Vec(Order),()=>{
        return orderStorage.values()
    }),

    confirmDelivery: update([Principal, Principal], Result(Order, Error),(id, uniqueNumber)=>{
        const orderOpt = orderStorage.get(id)
        const acct = accounts.get(ic.caller())

        if( 'None' in acct){
            return Err({
                Error: id
            })
        }
        if( 'None' in orderOpt){
            return Err({
                OrderDoesNotExist: id
            })
        }
        const order = orderOpt.Some
        if(ic.caller().toString() != order.buyer.toString()){
            return Err({
                NotTheBuyer: id
            })
        }
        if(order.paid != true && order.Delivered != false){
            return Err({
                Error: id
            })
        }
         // Check if the provided unique number matches the order's unique number
        if (uniqueNumber.toString() !== order.uniqueNumber.toString()) {
            return Err({
                invalidUniqueNumber: "Invalid unique number",
            });
        }
        const ods: typeof Order = {
            ...order,
            Delivered: true
        }
        return Ok(ods)

    }),

    getUSer: query([], Principal,()=>{
        return ic.caller()
    }),
    RandomPrincipal: query([], Principal,()=>{
        const id = generateId()
        return id
    })
});


function getBalance(accountOpt: Opt<nat64>): nat64 {
    if ('None' in accountOpt) {
        return 0n;
    } else {
        return accountOpt.Some;
    }
}
function generateId(): Principal {
    const randomBytes = new Array(29)
        .fill(0)
        .map((_) => Math.floor(Math.random() * 256));

    return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}

