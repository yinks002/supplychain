import {
    Canister,
    ic,
    nat64,
    Opt,
    Principal,
    StableBTreeMap,
    update
} from 'azle';

let accounts = StableBTreeMap(Principal, nat64,0);

export default Canister({
    transfer: update([Principal, nat64], nat64, (to, amount) => {
        const from = ic.caller();

        const fromBalance = getBalance(accounts.get(from));
        const toBalance = getBalance(accounts.get(to));

        accounts.insert(from, fromBalance - amount);
        accounts.insert(to, toBalance + amount);

        return amount;
    })
});

function getBalance(accountOpt: Opt<nat64>): nat64 {
    if ('None' in accountOpt) {
        return 0n;
    } else {
        return accountOpt.Some;
    }
}
