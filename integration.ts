// Authors: [<Cooper Lebrun cooperlebrun@gmail.com>, <Sammi Sears sammisears1@gmail.com>]
// TODO: Split into modules

// Note: Relies on AlertifyJS library being required outside of js context
// i.e. in the final html output using <script src="..."
// AlertifyJS type declarations
// TODO: fill in optional parameter type dec.s for alertify functions
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

  public static babyyodas() {
    alertify.alert("send me baby yoda pictures pls", "plz");
  }
}

interface StringyObj { [key: string]: string }

// Shopify

interface Variant {
  id: number;
  quantity: number;
}

class MyShopify {
  public async add_to_cart(item: Variant): Promise<Response> {
    // NOTE: This assumes whatever items is a valid payload.
    // This isn't necessarily the case if interfaces are open types, e.g.
    // if you have an interface Foo with field bar: bool, are Foos all objects
    // with only bar: bool (closed), or any object containing *only* bar: bool.
    // (open).
    // TODO: research this problem
    const payload = JSON.stringify({ "items": [item] });
    return await fetch('/cart/add.js', {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
  }
}

// test code
let shop = new MyShopify();
let p = shop.add_to_cart({ id: 37542794723528, quantity: 1})
p.then(r => {
  console.info(r.json());
}).catch((err) => {
  console.error(err);
})

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

// ARI PartSmart add to cart Callback
/* Callback only works if addToCartARI is in traditional
   javascript "function _name_() ..." syntax */
async function addToCartARI(params_str: string): Promise<any> {
  try {
    const params = new ARIParams(params_str);
    console.log("Attempting to add product " + params.sku + " to cart.");

    // lookup sku using id_lookup service...
    const result = await Lookup.idOfSku(params.sku);
    console.log("looking up part " + params.sku + "...");
    if (!result.exists) throw Lookup.partNotAvailError(params.sku);
    console.log("Found " + params.sku + ", id = " + (result.val!));

    // Add to cart
    const cart = await BCCart.use();
    await cart.addItems((result.val!), params.quantity);
    const msg = "Successfully added " + params.sku + " to cart.";
    console.log(msg);
    alertify.success(msg);
  } catch (err) {
    let err_msg = "We couldn't add your item to the cart because: ";
    err_msg += err.message + "\n";
    err_msg += "We're sorry for the inconvenience, try calling us at 1 (844) 587-6937.";
    alertify.alert("Something went wrong!", err_msg);
    console.error(err_msg);
  }
}
