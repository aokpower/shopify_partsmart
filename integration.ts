// Authors: [<Cooper Lebrun cooperlebrun@gmail.com>, <Sammi Sears sammisears1@gmail.com>]
// TODO: Split into modules

// Note: Relies on AlertifyJS library being required outside of js context
//  See: frame.html

// AlertifyJS type declarations
interface AlertifyJSStatic {
  success(msg: string): void;
  error(msg: string): void;
  alert(title: string, msg: string): void;
}

declare var alertify: AlertifyJSStatic;

// Utility:
class MyUtil {
  public static promiseTimeout(ms: number, promise: Promise<any>): Promise<any> {
    let timeout = new Promise((_resolve, reject) => {
      let id = setTimeout(() => {
        clearTimeout(id);
        reject('Timed out in '+ms+' ms.');
      }, ms);
    });

    return Promise.race([promise, timeout]);
  }

  public static throwIfResNotOk(response: Response): Response {
    if (!response.ok) throw new Error(response.statusText)
    return response;
  }

  public static babyyodas(): void {
    alertify.alert("send me baby yoda pictures pls", "plz");
  }
}

interface StringyObj { [key: string]: string }

// Shopify

interface Variant {
  id: number;
  quantity: number;
}

interface HasItemCount {
  item_count: number;
}

enum ItemStatus {
  Added,
  Unprocessable,
}

interface ItemReq {
  status: ItemStatus
  description?: string
}

class MyShopify {
  private set_cart_count(item_count: number): void {
    const count_node: HTMLElement | null = document.querySelector("#CartCount>span")
    if (count_node === null) throw new Error("Couldn't find html node for cart count");

    count_node.innerText = String(item_count)
  }

  public async cart(): Promise<HasItemCount> {
    const resp = await fetch('/cart.js');
    MyUtil.throwIfResNotOk(resp);
    return await resp.json();
  }

  public async update_cart_count(): Promise<number> { 
    const cart = await this.cart()
    this.set_cart_count(cart.item_count);
    return cart.item_count;
  }

  public async add_to_cart(item: Variant): Promise<ItemReq> {
    // NOTE: This assumes whatever item is a valid payload.
    // This isn't necessarily the case if interfaces are open types, e.g.
    // if you have an interface Foo with field bar: bool, are Foos all objects
    // with only bar: bool (closed), or any object containing *only* bar: bool.
    // (open).
    // TODO: research this problem
    const payload = JSON.stringify({ "items": [item] });
    const resp = await fetch('/cart/add.js', {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    const json = await resp.json();

    switch (resp.status) {
      case 200: return { status: ItemStatus.Added }
      case 422: return { status: ItemStatus.Unprocessable, description: json.description }
      default: {
        console.error(`Unrecognized response code when adding to cart: ${resp.status}`, resp);
        throw new Error(json.description);
      }
    }
  }
}

// bare bones result type to avoid ext. dependency
interface Result<T> {
  val?: T;
  exists: boolean;
}

class Lookup {
  public static async idOfSku(ari_sku: string): Promise<Result<string>> {
    const endpoint: string = "https://idlookup.aokpower.com/check/";
    const response = await fetch(endpoint+String(ari_sku));
    if (!response.ok) throw this.serviceError();

    const result = await response.text();
    if (result === "") return { exists: false };
    return { val: result, exists: true };
  }

  public static serviceError(): Error {
    return new Error("There was an internal error in the part id lookup service.");
  }

  // SMELL: Too much business logic here
  public static partNotAvailError(sku: string): Error {
    return new Error("This part (" + sku + ") isn't available in the online store.");
  }
}

class ARIParams {
  private params: StringyObj;
  public sku: string;
  public quantity: number;

  constructor(params_string: string) {
    try {
      this.params = params_string.split("&")
        .map(param_string => param_string.split("="))
        .reduce((obj: StringyObj, param_pair) => {
          obj[param_pair[0]] = param_pair[1];
          return obj;
        }, {});

      this.sku = this.params["arisku"];
      this.quantity = Number(this.params["ariqty"]);
    } catch (err) { throw ARIParams.couldntParseError; }
  }

  private static couldntParseError(): Error {
    return new Error("Couldn't parse ARI parameters");
  }
}

// TODO: rewrite addToCartARI as non-async function (Having a return type of Promise<T> is unnecessary
/* Callback only works if addToCartARI is in "function _name_() ..." syntax */
async function addToCartARI(params_str: string): Promise<any> {
  try {
    const params = new ARIParams(params_str);

    // lookup sku using id_lookup service...
    const id_res = await Lookup.idOfSku(params.sku);
    console.log("looking up part " + params.sku + "...");
    if (!id_res.exists) throw Lookup.partNotAvailError(params.sku);
    console.log("Found " + params.sku + ", id = " + (id_res.val!));
    const id: number = Number(id_res.val!)

    // Add to cart
    const shop = new MyShopify();

    const itemreq = await shop.add_to_cart({ id: id, quantity: params.quantity })
    switch (itemreq.status) {
      case ItemStatus.Added: {
        const msg = "Successfully added " + params.sku + " to cart.";
        console.log(msg);
        alertify.success(msg);
        break;
      }
      case ItemStatus.Unprocessable: {
        alertify.alert("Can't add item to cart: This item is out of stock", itemreq.description!)
        break;
      }
      default: { // Should be unreachable if all members of ItemStatus have cases
        console.error(`Add to cart request has unknown ItemStatus: ${itemreq.status}`);
        throw new Error('Unhandled cart return status detected.')
      }
    }
  } catch (err) {
    let err_msg = "We're sorry; Your item couldn't be added to the cart:" + "\n";
    err_msg += err.message + "\n";
    err_msg += "Try calling us at 1 (844) 587-6937.";
    alertify.alert("Something went wrong!", err_msg);
    console.error(err_msg);
  }
}
