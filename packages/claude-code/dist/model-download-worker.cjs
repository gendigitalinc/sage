"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn2, res) => function __init() {
  return fn2 && (res = (0, fn2[__getOwnPropNames(fn2)[0]])(fn2 = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to2, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to2, key) && key !== except)
        __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to2;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/tar@7.5.13/node_modules/tar/dist/esm/index.min.js
var index_min_exports = {};
__export(index_min_exports, {
  Header: () => F,
  Pack: () => Et,
  PackJob: () => di,
  PackSync: () => kt,
  Parser: () => st,
  Pax: () => ct,
  ReadEntry: () => Yt,
  Unpack: () => qt,
  UnpackSync: () => Te,
  WriteEntry: () => de,
  WriteEntrySync: () => si,
  WriteEntryTar: () => ri,
  c: () => Zn,
  create: () => Zn,
  extract: () => co,
  filesFilter: () => Ki,
  list: () => It,
  r: () => vt,
  replace: () => vt,
  t: () => It,
  types: () => Bi,
  u: () => wo,
  update: () => wo,
  x: () => co
});
function Bn(s3, t, e) {
  let i = t, r = t ? t.next : s3.head, n = new ue(e, i, r, s3);
  return n.next === void 0 && (s3.tail = n), n.prev === void 0 && (s3.head = n), s3.length++, n;
}
function Pn(s3, t) {
  s3.tail = new ue(t, s3.tail, void 0, s3), s3.head || (s3.head = s3.tail), s3.length++;
}
function zn(s3, t) {
  s3.head = new ue(t, void 0, s3.head, s3), s3.tail || (s3.tail = s3.head), s3.length++;
}
var import_events, import_fs, import_node_events, import_node_stream, import_node_string_decoder, import_node_path4, import_node_fs2, import_path, import_events2, import_assert, import_buffer, ks, import_zlib, import_node_path5, import_node_path6, import_fs2, import_fs3, import_path2, import_node_path7, import_path3, import_node_fs3, import_node_assert, import_node_crypto2, import_node_fs4, import_node_path8, import_fs4, import_node_fs5, import_node_path9, import_node_fs6, import_promises2, import_node_path10, import_node_path11, import_node_fs7, import_node_path12, kr, vr, Os, Br, Pr, zr, q, j, rt, Le, jt, Ne, Ts, Ae, xs, z, Mt, b, Qt, Bt, _, A, g, yi, De, L, w, Ri, bi, Ls, _i, Z, gi, Ie, Jt, yt, C, te, Ur, Hr, Wr, Gr, Ce, Oi, Zr, Yr, D, Vr, ot, H, ee, m, xi, J, Li, Ii, Ci, se, Fe, Ut, Ht, Ni, Pt, ht, U, nt, Y, zt, Ai, Q, ie, Di, ke, Rt, ve, bt, _t, Me, tt, Wt, $r, As, Ds, Is, Cs, Fs, Xr, re, K, jr, M, Qr, vs, Jr, ki, Ot, Gt, vi, ne, Be, Pe, ze, Ue, He, We, Ge, Ze, Ye, Ms, en, sn, Bs, rn, nn, Ps, zs, Bi, oe, hn, he, Ke, F, an, Tt, Pi, ln, at, cn, fn, dn, lt, un, mn, pn, zi, En, xt, ct, Sn, yn, Rn, bn, f, Yt, Lt, gn, Zi, Yi, On, B, Nt, et, Ui, Us, V, ae, ft, Hs, p, it, dt, Hi, At, y, Ve, $e, Wi, Ws, Gs, le, Gi, Xe, Kt, ut, qe, Dt, je, Qe, Zs, Tn, st, mt, Nn, Ki, An, Dn, It, Vi, Cn, Ys, ce, Je, $i, Fn, kn, Xi, Ks, Js, vn, Xs, qs, js, ji, Qs, fe, ti, Qi, ei, Ji, ts, es, is, pt, ii, ss, qi, X, de, si, ri, Mn, ni, ue, di, tr, oi, me, W, Ct, Ft, pe, rs, G, ns, hi, er, as, ls, ai, li, ir, os, ci, rr, hs, Et, kt, Un, Hn, or, hr, Wn, Gn, Zn, Yn, fr, dr, ar, ur, mr, pr, Kn, Vn, $n, lr, cs, fs2, ui, Xn, ds, qn, us, we, wt, Qn, Er, ms, wr, Jn, Sr, ps, yr, $t, Rr, to, eo, io, Ei, _r, gr, ys, Or, Rs, P, bs, _s, Si, Tr, xr, ye, Lr, Nr, Es, St, O, wi, Ar, Xt, ws, Ss, gs, Re, be, _e, ge, ro, Oe, no, oo, ho, Dr, qt, Se, Te, ao, lo, co, fo, uo, mo, po, Eo, vt, wo, So;
var init_index_min = __esm({
  "../../node_modules/.pnpm/tar@7.5.13/node_modules/tar/dist/esm/index.min.js"() {
    import_events = __toESM(require("events"), 1);
    import_fs = __toESM(require("fs"), 1);
    import_node_events = require("node:events");
    import_node_stream = __toESM(require("node:stream"), 1);
    import_node_string_decoder = require("node:string_decoder");
    import_node_path4 = __toESM(require("node:path"), 1);
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_path = require("path");
    import_events2 = require("events");
    import_assert = __toESM(require("assert"), 1);
    import_buffer = require("buffer");
    ks = __toESM(require("zlib"), 1);
    import_zlib = __toESM(require("zlib"), 1);
    import_node_path5 = require("node:path");
    import_node_path6 = require("node:path");
    import_fs2 = __toESM(require("fs"), 1);
    import_fs3 = __toESM(require("fs"), 1);
    import_path2 = __toESM(require("path"), 1);
    import_node_path7 = require("node:path");
    import_path3 = __toESM(require("path"), 1);
    import_node_fs3 = __toESM(require("node:fs"), 1);
    import_node_assert = __toESM(require("node:assert"), 1);
    import_node_crypto2 = require("node:crypto");
    import_node_fs4 = __toESM(require("node:fs"), 1);
    import_node_path8 = __toESM(require("node:path"), 1);
    import_fs4 = __toESM(require("fs"), 1);
    import_node_fs5 = __toESM(require("node:fs"), 1);
    import_node_path9 = __toESM(require("node:path"), 1);
    import_node_fs6 = __toESM(require("node:fs"), 1);
    import_promises2 = __toESM(require("node:fs/promises"), 1);
    import_node_path10 = __toESM(require("node:path"), 1);
    import_node_path11 = require("node:path");
    import_node_fs7 = __toESM(require("node:fs"), 1);
    import_node_path12 = __toESM(require("node:path"), 1);
    kr = Object.defineProperty;
    vr = (s3, t) => {
      for (var e in t) kr(s3, e, { get: t[e], enumerable: true });
    };
    Os = typeof process == "object" && process ? process : { stdout: null, stderr: null };
    Br = (s3) => !!s3 && typeof s3 == "object" && (s3 instanceof D || s3 instanceof import_node_stream.default || Pr(s3) || zr(s3));
    Pr = (s3) => !!s3 && typeof s3 == "object" && s3 instanceof import_node_events.EventEmitter && typeof s3.pipe == "function" && s3.pipe !== import_node_stream.default.Writable.prototype.pipe;
    zr = (s3) => !!s3 && typeof s3 == "object" && s3 instanceof import_node_events.EventEmitter && typeof s3.write == "function" && typeof s3.end == "function";
    q = Symbol("EOF");
    j = Symbol("maybeEmitEnd");
    rt = Symbol("emittedEnd");
    Le = Symbol("emittingEnd");
    jt = Symbol("emittedError");
    Ne = Symbol("closed");
    Ts = Symbol("read");
    Ae = Symbol("flush");
    xs = Symbol("flushChunk");
    z = Symbol("encoding");
    Mt = Symbol("decoder");
    b = Symbol("flowing");
    Qt = Symbol("paused");
    Bt = Symbol("resume");
    _ = Symbol("buffer");
    A = Symbol("pipes");
    g = Symbol("bufferLength");
    yi = Symbol("bufferPush");
    De = Symbol("bufferShift");
    L = Symbol("objectMode");
    w = Symbol("destroyed");
    Ri = Symbol("error");
    bi = Symbol("emitData");
    Ls = Symbol("emitEnd");
    _i = Symbol("emitEnd2");
    Z = Symbol("async");
    gi = Symbol("abort");
    Ie = Symbol("aborted");
    Jt = Symbol("signal");
    yt = Symbol("dataListeners");
    C = Symbol("discarded");
    te = (s3) => Promise.resolve().then(s3);
    Ur = (s3) => s3();
    Hr = (s3) => s3 === "end" || s3 === "finish" || s3 === "prefinish";
    Wr = (s3) => s3 instanceof ArrayBuffer || !!s3 && typeof s3 == "object" && s3.constructor && s3.constructor.name === "ArrayBuffer" && s3.byteLength >= 0;
    Gr = (s3) => !Buffer.isBuffer(s3) && ArrayBuffer.isView(s3);
    Ce = class {
      src;
      dest;
      opts;
      ondrain;
      constructor(t, e, i) {
        this.src = t, this.dest = e, this.opts = i, this.ondrain = () => t[Bt](), this.dest.on("drain", this.ondrain);
      }
      unpipe() {
        this.dest.removeListener("drain", this.ondrain);
      }
      proxyErrors(t) {
      }
      end() {
        this.unpipe(), this.opts.end && this.dest.end();
      }
    };
    Oi = class extends Ce {
      unpipe() {
        this.src.removeListener("error", this.proxyErrors), super.unpipe();
      }
      constructor(t, e, i) {
        super(t, e, i), this.proxyErrors = (r) => this.dest.emit("error", r), t.on("error", this.proxyErrors);
      }
    };
    Zr = (s3) => !!s3.objectMode;
    Yr = (s3) => !s3.objectMode && !!s3.encoding && s3.encoding !== "buffer";
    D = class extends import_node_events.EventEmitter {
      [b] = false;
      [Qt] = false;
      [A] = [];
      [_] = [];
      [L];
      [z];
      [Z];
      [Mt];
      [q] = false;
      [rt] = false;
      [Le] = false;
      [Ne] = false;
      [jt] = null;
      [g] = 0;
      [w] = false;
      [Jt];
      [Ie] = false;
      [yt] = 0;
      [C] = false;
      writable = true;
      readable = true;
      constructor(...t) {
        let e = t[0] || {};
        if (super(), e.objectMode && typeof e.encoding == "string") throw new TypeError("Encoding and objectMode may not be used together");
        Zr(e) ? (this[L] = true, this[z] = null) : Yr(e) ? (this[z] = e.encoding, this[L] = false) : (this[L] = false, this[z] = null), this[Z] = !!e.async, this[Mt] = this[z] ? new import_node_string_decoder.StringDecoder(this[z]) : null, e && e.debugExposeBuffer === true && Object.defineProperty(this, "buffer", { get: () => this[_] }), e && e.debugExposePipes === true && Object.defineProperty(this, "pipes", { get: () => this[A] });
        let { signal: i } = e;
        i && (this[Jt] = i, i.aborted ? this[gi]() : i.addEventListener("abort", () => this[gi]()));
      }
      get bufferLength() {
        return this[g];
      }
      get encoding() {
        return this[z];
      }
      set encoding(t) {
        throw new Error("Encoding must be set at instantiation time");
      }
      setEncoding(t) {
        throw new Error("Encoding must be set at instantiation time");
      }
      get objectMode() {
        return this[L];
      }
      set objectMode(t) {
        throw new Error("objectMode must be set at instantiation time");
      }
      get async() {
        return this[Z];
      }
      set async(t) {
        this[Z] = this[Z] || !!t;
      }
      [gi]() {
        this[Ie] = true, this.emit("abort", this[Jt]?.reason), this.destroy(this[Jt]?.reason);
      }
      get aborted() {
        return this[Ie];
      }
      set aborted(t) {
      }
      write(t, e, i) {
        if (this[Ie]) return false;
        if (this[q]) throw new Error("write after end");
        if (this[w]) return this.emit("error", Object.assign(new Error("Cannot call write after a stream was destroyed"), { code: "ERR_STREAM_DESTROYED" })), true;
        typeof e == "function" && (i = e, e = "utf8"), e || (e = "utf8");
        let r = this[Z] ? te : Ur;
        if (!this[L] && !Buffer.isBuffer(t)) {
          if (Gr(t)) t = Buffer.from(t.buffer, t.byteOffset, t.byteLength);
          else if (Wr(t)) t = Buffer.from(t);
          else if (typeof t != "string") throw new Error("Non-contiguous data written to non-objectMode stream");
        }
        return this[L] ? (this[b] && this[g] !== 0 && this[Ae](true), this[b] ? this.emit("data", t) : this[yi](t), this[g] !== 0 && this.emit("readable"), i && r(i), this[b]) : t.length ? (typeof t == "string" && !(e === this[z] && !this[Mt]?.lastNeed) && (t = Buffer.from(t, e)), Buffer.isBuffer(t) && this[z] && (t = this[Mt].write(t)), this[b] && this[g] !== 0 && this[Ae](true), this[b] ? this.emit("data", t) : this[yi](t), this[g] !== 0 && this.emit("readable"), i && r(i), this[b]) : (this[g] !== 0 && this.emit("readable"), i && r(i), this[b]);
      }
      read(t) {
        if (this[w]) return null;
        if (this[C] = false, this[g] === 0 || t === 0 || t && t > this[g]) return this[j](), null;
        this[L] && (t = null), this[_].length > 1 && !this[L] && (this[_] = [this[z] ? this[_].join("") : Buffer.concat(this[_], this[g])]);
        let e = this[Ts](t || null, this[_][0]);
        return this[j](), e;
      }
      [Ts](t, e) {
        if (this[L]) this[De]();
        else {
          let i = e;
          t === i.length || t === null ? this[De]() : typeof i == "string" ? (this[_][0] = i.slice(t), e = i.slice(0, t), this[g] -= t) : (this[_][0] = i.subarray(t), e = i.subarray(0, t), this[g] -= t);
        }
        return this.emit("data", e), !this[_].length && !this[q] && this.emit("drain"), e;
      }
      end(t, e, i) {
        return typeof t == "function" && (i = t, t = void 0), typeof e == "function" && (i = e, e = "utf8"), t !== void 0 && this.write(t, e), i && this.once("end", i), this[q] = true, this.writable = false, (this[b] || !this[Qt]) && this[j](), this;
      }
      [Bt]() {
        this[w] || (!this[yt] && !this[A].length && (this[C] = true), this[Qt] = false, this[b] = true, this.emit("resume"), this[_].length ? this[Ae]() : this[q] ? this[j]() : this.emit("drain"));
      }
      resume() {
        return this[Bt]();
      }
      pause() {
        this[b] = false, this[Qt] = true, this[C] = false;
      }
      get destroyed() {
        return this[w];
      }
      get flowing() {
        return this[b];
      }
      get paused() {
        return this[Qt];
      }
      [yi](t) {
        this[L] ? this[g] += 1 : this[g] += t.length, this[_].push(t);
      }
      [De]() {
        return this[L] ? this[g] -= 1 : this[g] -= this[_][0].length, this[_].shift();
      }
      [Ae](t = false) {
        do
          ;
        while (this[xs](this[De]()) && this[_].length);
        !t && !this[_].length && !this[q] && this.emit("drain");
      }
      [xs](t) {
        return this.emit("data", t), this[b];
      }
      pipe(t, e) {
        if (this[w]) return t;
        this[C] = false;
        let i = this[rt];
        return e = e || {}, t === Os.stdout || t === Os.stderr ? e.end = false : e.end = e.end !== false, e.proxyErrors = !!e.proxyErrors, i ? e.end && t.end() : (this[A].push(e.proxyErrors ? new Oi(this, t, e) : new Ce(this, t, e)), this[Z] ? te(() => this[Bt]()) : this[Bt]()), t;
      }
      unpipe(t) {
        let e = this[A].find((i) => i.dest === t);
        e && (this[A].length === 1 ? (this[b] && this[yt] === 0 && (this[b] = false), this[A] = []) : this[A].splice(this[A].indexOf(e), 1), e.unpipe());
      }
      addListener(t, e) {
        return this.on(t, e);
      }
      on(t, e) {
        let i = super.on(t, e);
        if (t === "data") this[C] = false, this[yt]++, !this[A].length && !this[b] && this[Bt]();
        else if (t === "readable" && this[g] !== 0) super.emit("readable");
        else if (Hr(t) && this[rt]) super.emit(t), this.removeAllListeners(t);
        else if (t === "error" && this[jt]) {
          let r = e;
          this[Z] ? te(() => r.call(this, this[jt])) : r.call(this, this[jt]);
        }
        return i;
      }
      removeListener(t, e) {
        return this.off(t, e);
      }
      off(t, e) {
        let i = super.off(t, e);
        return t === "data" && (this[yt] = this.listeners("data").length, this[yt] === 0 && !this[C] && !this[A].length && (this[b] = false)), i;
      }
      removeAllListeners(t) {
        let e = super.removeAllListeners(t);
        return (t === "data" || t === void 0) && (this[yt] = 0, !this[C] && !this[A].length && (this[b] = false)), e;
      }
      get emittedEnd() {
        return this[rt];
      }
      [j]() {
        !this[Le] && !this[rt] && !this[w] && this[_].length === 0 && this[q] && (this[Le] = true, this.emit("end"), this.emit("prefinish"), this.emit("finish"), this[Ne] && this.emit("close"), this[Le] = false);
      }
      emit(t, ...e) {
        let i = e[0];
        if (t !== "error" && t !== "close" && t !== w && this[w]) return false;
        if (t === "data") return !this[L] && !i ? false : this[Z] ? (te(() => this[bi](i)), true) : this[bi](i);
        if (t === "end") return this[Ls]();
        if (t === "close") {
          if (this[Ne] = true, !this[rt] && !this[w]) return false;
          let n = super.emit("close");
          return this.removeAllListeners("close"), n;
        } else if (t === "error") {
          this[jt] = i, super.emit(Ri, i);
          let n = !this[Jt] || this.listeners("error").length ? super.emit("error", i) : false;
          return this[j](), n;
        } else if (t === "resume") {
          let n = super.emit("resume");
          return this[j](), n;
        } else if (t === "finish" || t === "prefinish") {
          let n = super.emit(t);
          return this.removeAllListeners(t), n;
        }
        let r = super.emit(t, ...e);
        return this[j](), r;
      }
      [bi](t) {
        for (let i of this[A]) i.dest.write(t) === false && this.pause();
        let e = this[C] ? false : super.emit("data", t);
        return this[j](), e;
      }
      [Ls]() {
        return this[rt] ? false : (this[rt] = true, this.readable = false, this[Z] ? (te(() => this[_i]()), true) : this[_i]());
      }
      [_i]() {
        if (this[Mt]) {
          let e = this[Mt].end();
          if (e) {
            for (let i of this[A]) i.dest.write(e);
            this[C] || super.emit("data", e);
          }
        }
        for (let e of this[A]) e.end();
        let t = super.emit("end");
        return this.removeAllListeners("end"), t;
      }
      async collect() {
        let t = Object.assign([], { dataLength: 0 });
        this[L] || (t.dataLength = 0);
        let e = this.promise();
        return this.on("data", (i) => {
          t.push(i), this[L] || (t.dataLength += i.length);
        }), await e, t;
      }
      async concat() {
        if (this[L]) throw new Error("cannot concat in objectMode");
        let t = await this.collect();
        return this[z] ? t.join("") : Buffer.concat(t, t.dataLength);
      }
      async promise() {
        return new Promise((t, e) => {
          this.on(w, () => e(new Error("stream destroyed"))), this.on("error", (i) => e(i)), this.on("end", () => t());
        });
      }
      [Symbol.asyncIterator]() {
        this[C] = false;
        let t = false, e = async () => (this.pause(), t = true, { value: void 0, done: true });
        return { next: () => {
          if (t) return e();
          let r = this.read();
          if (r !== null) return Promise.resolve({ done: false, value: r });
          if (this[q]) return e();
          let n, o, h = (d) => {
            this.off("data", a), this.off("end", l), this.off(w, c), e(), o(d);
          }, a = (d) => {
            this.off("error", h), this.off("end", l), this.off(w, c), this.pause(), n({ value: d, done: !!this[q] });
          }, l = () => {
            this.off("error", h), this.off("data", a), this.off(w, c), e(), n({ done: true, value: void 0 });
          }, c = () => h(new Error("stream destroyed"));
          return new Promise((d, S) => {
            o = S, n = d, this.once(w, c), this.once("error", h), this.once("end", l), this.once("data", a);
          });
        }, throw: e, return: e, [Symbol.asyncIterator]() {
          return this;
        }, [Symbol.asyncDispose]: async () => {
        } };
      }
      [Symbol.iterator]() {
        this[C] = false;
        let t = false, e = () => (this.pause(), this.off(Ri, e), this.off(w, e), this.off("end", e), t = true, { done: true, value: void 0 }), i = () => {
          if (t) return e();
          let r = this.read();
          return r === null ? e() : { done: false, value: r };
        };
        return this.once("end", e), this.once(Ri, e), this.once(w, e), { next: i, throw: e, return: e, [Symbol.iterator]() {
          return this;
        }, [Symbol.dispose]: () => {
        } };
      }
      destroy(t) {
        if (this[w]) return t ? this.emit("error", t) : this.emit(w), this;
        this[w] = true, this[C] = true, this[_].length = 0, this[g] = 0;
        let e = this;
        return typeof e.close == "function" && !this[Ne] && e.close(), t ? this.emit("error", t) : this.emit(w), this;
      }
      static get isStream() {
        return Br;
      }
    };
    Vr = import_fs.default.writev;
    ot = Symbol("_autoClose");
    H = Symbol("_close");
    ee = Symbol("_ended");
    m = Symbol("_fd");
    xi = Symbol("_finished");
    J = Symbol("_flags");
    Li = Symbol("_flush");
    Ii = Symbol("_handleChunk");
    Ci = Symbol("_makeBuf");
    se = Symbol("_mode");
    Fe = Symbol("_needDrain");
    Ut = Symbol("_onerror");
    Ht = Symbol("_onopen");
    Ni = Symbol("_onread");
    Pt = Symbol("_onwrite");
    ht = Symbol("_open");
    U = Symbol("_path");
    nt = Symbol("_pos");
    Y = Symbol("_queue");
    zt = Symbol("_read");
    Ai = Symbol("_readSize");
    Q = Symbol("_reading");
    ie = Symbol("_remain");
    Di = Symbol("_size");
    ke = Symbol("_write");
    Rt = Symbol("_writing");
    ve = Symbol("_defaultFlag");
    bt = Symbol("_errored");
    _t = class extends D {
      [bt] = false;
      [m];
      [U];
      [Ai];
      [Q] = false;
      [Di];
      [ie];
      [ot];
      constructor(t, e) {
        if (e = e || {}, super(e), this.readable = true, this.writable = false, typeof t != "string") throw new TypeError("path must be a string");
        this[bt] = false, this[m] = typeof e.fd == "number" ? e.fd : void 0, this[U] = t, this[Ai] = e.readSize || 16 * 1024 * 1024, this[Q] = false, this[Di] = typeof e.size == "number" ? e.size : 1 / 0, this[ie] = this[Di], this[ot] = typeof e.autoClose == "boolean" ? e.autoClose : true, typeof this[m] == "number" ? this[zt]() : this[ht]();
      }
      get fd() {
        return this[m];
      }
      get path() {
        return this[U];
      }
      write() {
        throw new TypeError("this is a readable stream");
      }
      end() {
        throw new TypeError("this is a readable stream");
      }
      [ht]() {
        import_fs.default.open(this[U], "r", (t, e) => this[Ht](t, e));
      }
      [Ht](t, e) {
        t ? this[Ut](t) : (this[m] = e, this.emit("open", e), this[zt]());
      }
      [Ci]() {
        return Buffer.allocUnsafe(Math.min(this[Ai], this[ie]));
      }
      [zt]() {
        if (!this[Q]) {
          this[Q] = true;
          let t = this[Ci]();
          if (t.length === 0) return process.nextTick(() => this[Ni](null, 0, t));
          import_fs.default.read(this[m], t, 0, t.length, null, (e, i, r) => this[Ni](e, i, r));
        }
      }
      [Ni](t, e, i) {
        this[Q] = false, t ? this[Ut](t) : this[Ii](e, i) && this[zt]();
      }
      [H]() {
        if (this[ot] && typeof this[m] == "number") {
          let t = this[m];
          this[m] = void 0, import_fs.default.close(t, (e) => e ? this.emit("error", e) : this.emit("close"));
        }
      }
      [Ut](t) {
        this[Q] = true, this[H](), this.emit("error", t);
      }
      [Ii](t, e) {
        let i = false;
        return this[ie] -= t, t > 0 && (i = super.write(t < e.length ? e.subarray(0, t) : e)), (t === 0 || this[ie] <= 0) && (i = false, this[H](), super.end()), i;
      }
      emit(t, ...e) {
        switch (t) {
          case "prefinish":
          case "finish":
            return false;
          case "drain":
            return typeof this[m] == "number" && this[zt](), false;
          case "error":
            return this[bt] ? false : (this[bt] = true, super.emit(t, ...e));
          default:
            return super.emit(t, ...e);
        }
      }
    };
    Me = class extends _t {
      [ht]() {
        let t = true;
        try {
          this[Ht](null, import_fs.default.openSync(this[U], "r")), t = false;
        } finally {
          t && this[H]();
        }
      }
      [zt]() {
        let t = true;
        try {
          if (!this[Q]) {
            this[Q] = true;
            do {
              let e = this[Ci](), i = e.length === 0 ? 0 : import_fs.default.readSync(this[m], e, 0, e.length, null);
              if (!this[Ii](i, e)) break;
            } while (true);
            this[Q] = false;
          }
          t = false;
        } finally {
          t && this[H]();
        }
      }
      [H]() {
        if (this[ot] && typeof this[m] == "number") {
          let t = this[m];
          this[m] = void 0, import_fs.default.closeSync(t), this.emit("close");
        }
      }
    };
    tt = class extends import_events.default {
      readable = false;
      writable = true;
      [bt] = false;
      [Rt] = false;
      [ee] = false;
      [Y] = [];
      [Fe] = false;
      [U];
      [se];
      [ot];
      [m];
      [ve];
      [J];
      [xi] = false;
      [nt];
      constructor(t, e) {
        e = e || {}, super(e), this[U] = t, this[m] = typeof e.fd == "number" ? e.fd : void 0, this[se] = e.mode === void 0 ? 438 : e.mode, this[nt] = typeof e.start == "number" ? e.start : void 0, this[ot] = typeof e.autoClose == "boolean" ? e.autoClose : true;
        let i = this[nt] !== void 0 ? "r+" : "w";
        this[ve] = e.flags === void 0, this[J] = e.flags === void 0 ? i : e.flags, this[m] === void 0 && this[ht]();
      }
      emit(t, ...e) {
        if (t === "error") {
          if (this[bt]) return false;
          this[bt] = true;
        }
        return super.emit(t, ...e);
      }
      get fd() {
        return this[m];
      }
      get path() {
        return this[U];
      }
      [Ut](t) {
        this[H](), this[Rt] = true, this.emit("error", t);
      }
      [ht]() {
        import_fs.default.open(this[U], this[J], this[se], (t, e) => this[Ht](t, e));
      }
      [Ht](t, e) {
        this[ve] && this[J] === "r+" && t && t.code === "ENOENT" ? (this[J] = "w", this[ht]()) : t ? this[Ut](t) : (this[m] = e, this.emit("open", e), this[Rt] || this[Li]());
      }
      end(t, e) {
        return t && this.write(t, e), this[ee] = true, !this[Rt] && !this[Y].length && typeof this[m] == "number" && this[Pt](null, 0), this;
      }
      write(t, e) {
        return typeof t == "string" && (t = Buffer.from(t, e)), this[ee] ? (this.emit("error", new Error("write() after end()")), false) : this[m] === void 0 || this[Rt] || this[Y].length ? (this[Y].push(t), this[Fe] = true, false) : (this[Rt] = true, this[ke](t), true);
      }
      [ke](t) {
        import_fs.default.write(this[m], t, 0, t.length, this[nt], (e, i) => this[Pt](e, i));
      }
      [Pt](t, e) {
        t ? this[Ut](t) : (this[nt] !== void 0 && typeof e == "number" && (this[nt] += e), this[Y].length ? this[Li]() : (this[Rt] = false, this[ee] && !this[xi] ? (this[xi] = true, this[H](), this.emit("finish")) : this[Fe] && (this[Fe] = false, this.emit("drain"))));
      }
      [Li]() {
        if (this[Y].length === 0) this[ee] && this[Pt](null, 0);
        else if (this[Y].length === 1) this[ke](this[Y].pop());
        else {
          let t = this[Y];
          this[Y] = [], Vr(this[m], t, this[nt], (e, i) => this[Pt](e, i));
        }
      }
      [H]() {
        if (this[ot] && typeof this[m] == "number") {
          let t = this[m];
          this[m] = void 0, import_fs.default.close(t, (e) => e ? this.emit("error", e) : this.emit("close"));
        }
      }
    };
    Wt = class extends tt {
      [ht]() {
        let t;
        if (this[ve] && this[J] === "r+") try {
          t = import_fs.default.openSync(this[U], this[J], this[se]);
        } catch (e) {
          if (e?.code === "ENOENT") return this[J] = "w", this[ht]();
          throw e;
        }
        else t = import_fs.default.openSync(this[U], this[J], this[se]);
        this[Ht](null, t);
      }
      [H]() {
        if (this[ot] && typeof this[m] == "number") {
          let t = this[m];
          this[m] = void 0, import_fs.default.closeSync(t), this.emit("close");
        }
      }
      [ke](t) {
        let e = true;
        try {
          this[Pt](null, import_fs.default.writeSync(this[m], t, 0, t.length, this[nt])), e = false;
        } finally {
          if (e) try {
            this[H]();
          } catch {
          }
        }
      }
    };
    $r = /* @__PURE__ */ new Map([["C", "cwd"], ["f", "file"], ["z", "gzip"], ["P", "preservePaths"], ["U", "unlink"], ["strip-components", "strip"], ["stripComponents", "strip"], ["keep-newer", "newer"], ["keepNewer", "newer"], ["keep-newer-files", "newer"], ["keepNewerFiles", "newer"], ["k", "keep"], ["keep-existing", "keep"], ["keepExisting", "keep"], ["m", "noMtime"], ["no-mtime", "noMtime"], ["p", "preserveOwner"], ["L", "follow"], ["h", "follow"], ["onentry", "onReadEntry"]]);
    As = (s3) => !!s3.sync && !!s3.file;
    Ds = (s3) => !s3.sync && !!s3.file;
    Is = (s3) => !!s3.sync && !s3.file;
    Cs = (s3) => !s3.sync && !s3.file;
    Fs = (s3) => !!s3.file;
    Xr = (s3) => {
      let t = $r.get(s3);
      return t || s3;
    };
    re = (s3 = {}) => {
      if (!s3) return {};
      let t = {};
      for (let [e, i] of Object.entries(s3)) {
        let r = Xr(e);
        t[r] = i;
      }
      return t.chmod === void 0 && t.noChmod === false && (t.chmod = true), delete t.noChmod, t;
    };
    K = (s3, t, e, i, r) => Object.assign((n = [], o, h) => {
      Array.isArray(n) && (o = n, n = {}), typeof o == "function" && (h = o, o = void 0), o = o ? Array.from(o) : [];
      let a = re(n);
      if (r?.(a, o), As(a)) {
        if (typeof h == "function") throw new TypeError("callback not supported for sync tar functions");
        return s3(a, o);
      } else if (Ds(a)) {
        let l = t(a, o);
        return h ? l.then(() => h(), h) : l;
      } else if (Is(a)) {
        if (typeof h == "function") throw new TypeError("callback not supported for sync tar functions");
        return e(a, o);
      } else if (Cs(a)) {
        if (typeof h == "function") throw new TypeError("callback only supported with file option");
        return i(a, o);
      }
      throw new Error("impossible options??");
    }, { syncFile: s3, asyncFile: t, syncNoFile: e, asyncNoFile: i, validate: r });
    jr = import_zlib.default.constants || { ZLIB_VERNUM: 4736 };
    M = Object.freeze(Object.assign(/* @__PURE__ */ Object.create(null), { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_MEM_ERROR: -4, Z_BUF_ERROR: -5, Z_VERSION_ERROR: -6, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, DEFLATE: 1, INFLATE: 2, GZIP: 3, GUNZIP: 4, DEFLATERAW: 5, INFLATERAW: 6, UNZIP: 7, BROTLI_DECODE: 8, BROTLI_ENCODE: 9, Z_MIN_WINDOWBITS: 8, Z_MAX_WINDOWBITS: 15, Z_DEFAULT_WINDOWBITS: 15, Z_MIN_CHUNK: 64, Z_MAX_CHUNK: 1 / 0, Z_DEFAULT_CHUNK: 16384, Z_MIN_MEMLEVEL: 1, Z_MAX_MEMLEVEL: 9, Z_DEFAULT_MEMLEVEL: 8, Z_MIN_LEVEL: -1, Z_MAX_LEVEL: 9, Z_DEFAULT_LEVEL: -1, BROTLI_OPERATION_PROCESS: 0, BROTLI_OPERATION_FLUSH: 1, BROTLI_OPERATION_FINISH: 2, BROTLI_OPERATION_EMIT_METADATA: 3, BROTLI_MODE_GENERIC: 0, BROTLI_MODE_TEXT: 1, BROTLI_MODE_FONT: 2, BROTLI_DEFAULT_MODE: 0, BROTLI_MIN_QUALITY: 0, BROTLI_MAX_QUALITY: 11, BROTLI_DEFAULT_QUALITY: 11, BROTLI_MIN_WINDOW_BITS: 10, BROTLI_MAX_WINDOW_BITS: 24, BROTLI_LARGE_MAX_WINDOW_BITS: 30, BROTLI_DEFAULT_WINDOW: 22, BROTLI_MIN_INPUT_BLOCK_BITS: 16, BROTLI_MAX_INPUT_BLOCK_BITS: 24, BROTLI_PARAM_MODE: 0, BROTLI_PARAM_QUALITY: 1, BROTLI_PARAM_LGWIN: 2, BROTLI_PARAM_LGBLOCK: 3, BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING: 4, BROTLI_PARAM_SIZE_HINT: 5, BROTLI_PARAM_LARGE_WINDOW: 6, BROTLI_PARAM_NPOSTFIX: 7, BROTLI_PARAM_NDIRECT: 8, BROTLI_DECODER_RESULT_ERROR: 0, BROTLI_DECODER_RESULT_SUCCESS: 1, BROTLI_DECODER_RESULT_NEEDS_MORE_INPUT: 2, BROTLI_DECODER_RESULT_NEEDS_MORE_OUTPUT: 3, BROTLI_DECODER_PARAM_DISABLE_RING_BUFFER_REALLOCATION: 0, BROTLI_DECODER_PARAM_LARGE_WINDOW: 1, BROTLI_DECODER_NO_ERROR: 0, BROTLI_DECODER_SUCCESS: 1, BROTLI_DECODER_NEEDS_MORE_INPUT: 2, BROTLI_DECODER_NEEDS_MORE_OUTPUT: 3, BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_NIBBLE: -1, BROTLI_DECODER_ERROR_FORMAT_RESERVED: -2, BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_META_NIBBLE: -3, BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_ALPHABET: -4, BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_SAME: -5, BROTLI_DECODER_ERROR_FORMAT_CL_SPACE: -6, BROTLI_DECODER_ERROR_FORMAT_HUFFMAN_SPACE: -7, BROTLI_DECODER_ERROR_FORMAT_CONTEXT_MAP_REPEAT: -8, BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_1: -9, BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_2: -10, BROTLI_DECODER_ERROR_FORMAT_TRANSFORM: -11, BROTLI_DECODER_ERROR_FORMAT_DICTIONARY: -12, BROTLI_DECODER_ERROR_FORMAT_WINDOW_BITS: -13, BROTLI_DECODER_ERROR_FORMAT_PADDING_1: -14, BROTLI_DECODER_ERROR_FORMAT_PADDING_2: -15, BROTLI_DECODER_ERROR_FORMAT_DISTANCE: -16, BROTLI_DECODER_ERROR_DICTIONARY_NOT_SET: -19, BROTLI_DECODER_ERROR_INVALID_ARGUMENTS: -20, BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MODES: -21, BROTLI_DECODER_ERROR_ALLOC_TREE_GROUPS: -22, BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MAP: -25, BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_1: -26, BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_2: -27, BROTLI_DECODER_ERROR_ALLOC_BLOCK_TYPE_TREES: -30, BROTLI_DECODER_ERROR_UNREACHABLE: -31 }, jr));
    Qr = import_buffer.Buffer.concat;
    vs = Object.getOwnPropertyDescriptor(import_buffer.Buffer, "concat");
    Jr = (s3) => s3;
    ki = vs?.writable === true || vs?.set !== void 0 ? (s3) => {
      import_buffer.Buffer.concat = s3 ? Jr : Qr;
    } : (s3) => {
    };
    Ot = Symbol("_superWrite");
    Gt = class extends Error {
      code;
      errno;
      constructor(t, e) {
        super("zlib: " + t.message, { cause: t }), this.code = t.code, this.errno = t.errno, this.code || (this.code = "ZLIB_ERROR"), this.message = "zlib: " + t.message, Error.captureStackTrace(this, e ?? this.constructor);
      }
      get name() {
        return "ZlibError";
      }
    };
    vi = Symbol("flushFlag");
    ne = class extends D {
      #t = false;
      #i = false;
      #s;
      #n;
      #r;
      #e;
      #o;
      get sawError() {
        return this.#t;
      }
      get handle() {
        return this.#e;
      }
      get flushFlag() {
        return this.#s;
      }
      constructor(t, e) {
        if (!t || typeof t != "object") throw new TypeError("invalid options for ZlibBase constructor");
        if (super(t), this.#s = t.flush ?? 0, this.#n = t.finishFlush ?? 0, this.#r = t.fullFlushFlag ?? 0, typeof ks[e] != "function") throw new TypeError("Compression method not supported: " + e);
        try {
          this.#e = new ks[e](t);
        } catch (i) {
          throw new Gt(i, this.constructor);
        }
        this.#o = (i) => {
          this.#t || (this.#t = true, this.close(), this.emit("error", i));
        }, this.#e?.on("error", (i) => this.#o(new Gt(i))), this.once("end", () => this.close);
      }
      close() {
        this.#e && (this.#e.close(), this.#e = void 0, this.emit("close"));
      }
      reset() {
        if (!this.#t) return (0, import_assert.default)(this.#e, "zlib binding closed"), this.#e.reset?.();
      }
      flush(t) {
        this.ended || (typeof t != "number" && (t = this.#r), this.write(Object.assign(import_buffer.Buffer.alloc(0), { [vi]: t })));
      }
      end(t, e, i) {
        return typeof t == "function" && (i = t, e = void 0, t = void 0), typeof e == "function" && (i = e, e = void 0), t && (e ? this.write(t, e) : this.write(t)), this.flush(this.#n), this.#i = true, super.end(i);
      }
      get ended() {
        return this.#i;
      }
      [Ot](t) {
        return super.write(t);
      }
      write(t, e, i) {
        if (typeof e == "function" && (i = e, e = "utf8"), typeof t == "string" && (t = import_buffer.Buffer.from(t, e)), this.#t) return;
        (0, import_assert.default)(this.#e, "zlib binding closed");
        let r = this.#e._handle, n = r.close;
        r.close = () => {
        };
        let o = this.#e.close;
        this.#e.close = () => {
        }, ki(true);
        let h;
        try {
          let l = typeof t[vi] == "number" ? t[vi] : this.#s;
          h = this.#e._processChunk(t, l), ki(false);
        } catch (l) {
          ki(false), this.#o(new Gt(l, this.write));
        } finally {
          this.#e && (this.#e._handle = r, r.close = n, this.#e.close = o, this.#e.removeAllListeners("error"));
        }
        this.#e && this.#e.on("error", (l) => this.#o(new Gt(l, this.write)));
        let a;
        if (h) if (Array.isArray(h) && h.length > 0) {
          let l = h[0];
          a = this[Ot](import_buffer.Buffer.from(l));
          for (let c = 1; c < h.length; c++) a = this[Ot](h[c]);
        } else a = this[Ot](import_buffer.Buffer.from(h));
        return i && i(), a;
      }
    };
    Be = class extends ne {
      #t;
      #i;
      constructor(t, e) {
        t = t || {}, t.flush = t.flush || M.Z_NO_FLUSH, t.finishFlush = t.finishFlush || M.Z_FINISH, t.fullFlushFlag = M.Z_FULL_FLUSH, super(t, e), this.#t = t.level, this.#i = t.strategy;
      }
      params(t, e) {
        if (!this.sawError) {
          if (!this.handle) throw new Error("cannot switch params when binding is closed");
          if (!this.handle.params) throw new Error("not supported in this implementation");
          if (this.#t !== t || this.#i !== e) {
            this.flush(M.Z_SYNC_FLUSH), (0, import_assert.default)(this.handle, "zlib binding closed");
            let i = this.handle.flush;
            this.handle.flush = (r, n) => {
              typeof r == "function" && (n = r, r = this.flushFlag), this.flush(r), n?.();
            };
            try {
              this.handle.params(t, e);
            } finally {
              this.handle.flush = i;
            }
            this.handle && (this.#t = t, this.#i = e);
          }
        }
      }
    };
    Pe = class extends Be {
      #t;
      constructor(t) {
        super(t, "Gzip"), this.#t = t && !!t.portable;
      }
      [Ot](t) {
        return this.#t ? (this.#t = false, t[9] = 255, super[Ot](t)) : super[Ot](t);
      }
    };
    ze = class extends Be {
      constructor(t) {
        super(t, "Unzip");
      }
    };
    Ue = class extends ne {
      constructor(t, e) {
        t = t || {}, t.flush = t.flush || M.BROTLI_OPERATION_PROCESS, t.finishFlush = t.finishFlush || M.BROTLI_OPERATION_FINISH, t.fullFlushFlag = M.BROTLI_OPERATION_FLUSH, super(t, e);
      }
    };
    He = class extends Ue {
      constructor(t) {
        super(t, "BrotliCompress");
      }
    };
    We = class extends Ue {
      constructor(t) {
        super(t, "BrotliDecompress");
      }
    };
    Ge = class extends ne {
      constructor(t, e) {
        t = t || {}, t.flush = t.flush || M.ZSTD_e_continue, t.finishFlush = t.finishFlush || M.ZSTD_e_end, t.fullFlushFlag = M.ZSTD_e_flush, super(t, e);
      }
    };
    Ze = class extends Ge {
      constructor(t) {
        super(t, "ZstdCompress");
      }
    };
    Ye = class extends Ge {
      constructor(t) {
        super(t, "ZstdDecompress");
      }
    };
    Ms = (s3, t) => {
      if (Number.isSafeInteger(s3)) s3 < 0 ? sn(s3, t) : en(s3, t);
      else throw Error("cannot encode number outside of javascript safe integer range");
      return t;
    };
    en = (s3, t) => {
      t[0] = 128;
      for (var e = t.length; e > 1; e--) t[e - 1] = s3 & 255, s3 = Math.floor(s3 / 256);
    };
    sn = (s3, t) => {
      t[0] = 255;
      var e = false;
      s3 = s3 * -1;
      for (var i = t.length; i > 1; i--) {
        var r = s3 & 255;
        s3 = Math.floor(s3 / 256), e ? t[i - 1] = Ps(r) : r === 0 ? t[i - 1] = 0 : (e = true, t[i - 1] = zs(r));
      }
    };
    Bs = (s3) => {
      let t = s3[0], e = t === 128 ? nn(s3.subarray(1, s3.length)) : t === 255 ? rn(s3) : null;
      if (e === null) throw Error("invalid base256 encoding");
      if (!Number.isSafeInteger(e)) throw Error("parsed number outside of javascript safe integer range");
      return e;
    };
    rn = (s3) => {
      for (var t = s3.length, e = 0, i = false, r = t - 1; r > -1; r--) {
        var n = Number(s3[r]), o;
        i ? o = Ps(n) : n === 0 ? o = n : (i = true, o = zs(n)), o !== 0 && (e -= o * Math.pow(256, t - r - 1));
      }
      return e;
    };
    nn = (s3) => {
      for (var t = s3.length, e = 0, i = t - 1; i > -1; i--) {
        var r = Number(s3[i]);
        r !== 0 && (e += r * Math.pow(256, t - i - 1));
      }
      return e;
    };
    Ps = (s3) => (255 ^ s3) & 255;
    zs = (s3) => (255 ^ s3) + 1 & 255;
    Bi = {};
    vr(Bi, { code: () => Ke, isCode: () => oe, isName: () => hn, name: () => he });
    oe = (s3) => he.has(s3);
    hn = (s3) => Ke.has(s3);
    he = /* @__PURE__ */ new Map([["0", "File"], ["", "OldFile"], ["1", "Link"], ["2", "SymbolicLink"], ["3", "CharacterDevice"], ["4", "BlockDevice"], ["5", "Directory"], ["6", "FIFO"], ["7", "ContiguousFile"], ["g", "GlobalExtendedHeader"], ["x", "ExtendedHeader"], ["A", "SolarisACL"], ["D", "GNUDumpDir"], ["I", "Inode"], ["K", "NextFileHasLongLinkpath"], ["L", "NextFileHasLongPath"], ["M", "ContinuationFile"], ["N", "OldGnuLongPath"], ["S", "SparseFile"], ["V", "TapeVolumeHeader"], ["X", "OldExtendedHeader"]]);
    Ke = new Map(Array.from(he).map((s3) => [s3[1], s3[0]]));
    F = class {
      cksumValid = false;
      needPax = false;
      nullBlock = false;
      block;
      path;
      mode;
      uid;
      gid;
      size;
      cksum;
      #t = "Unsupported";
      linkpath;
      uname;
      gname;
      devmaj = 0;
      devmin = 0;
      atime;
      ctime;
      mtime;
      charset;
      comment;
      constructor(t, e = 0, i, r) {
        Buffer.isBuffer(t) ? this.decode(t, e || 0, i, r) : t && this.#i(t);
      }
      decode(t, e, i, r) {
        if (e || (e = 0), !t || !(t.length >= e + 512)) throw new Error("need 512 bytes for header");
        this.path = i?.path ?? Tt(t, e, 100), this.mode = i?.mode ?? r?.mode ?? at(t, e + 100, 8), this.uid = i?.uid ?? r?.uid ?? at(t, e + 108, 8), this.gid = i?.gid ?? r?.gid ?? at(t, e + 116, 8), this.size = i?.size ?? r?.size ?? at(t, e + 124, 12), this.mtime = i?.mtime ?? r?.mtime ?? Pi(t, e + 136, 12), this.cksum = at(t, e + 148, 12), r && this.#i(r, true), i && this.#i(i);
        let n = Tt(t, e + 156, 1);
        if (oe(n) && (this.#t = n || "0"), this.#t === "0" && this.path.slice(-1) === "/" && (this.#t = "5"), this.#t === "5" && (this.size = 0), this.linkpath = Tt(t, e + 157, 100), t.subarray(e + 257, e + 265).toString() === "ustar\x0000") if (this.uname = i?.uname ?? r?.uname ?? Tt(t, e + 265, 32), this.gname = i?.gname ?? r?.gname ?? Tt(t, e + 297, 32), this.devmaj = i?.devmaj ?? r?.devmaj ?? at(t, e + 329, 8) ?? 0, this.devmin = i?.devmin ?? r?.devmin ?? at(t, e + 337, 8) ?? 0, t[e + 475] !== 0) {
          let h = Tt(t, e + 345, 155);
          this.path = h + "/" + this.path;
        } else {
          let h = Tt(t, e + 345, 130);
          h && (this.path = h + "/" + this.path), this.atime = i?.atime ?? r?.atime ?? Pi(t, e + 476, 12), this.ctime = i?.ctime ?? r?.ctime ?? Pi(t, e + 488, 12);
        }
        let o = 256;
        for (let h = e; h < e + 148; h++) o += t[h];
        for (let h = e + 156; h < e + 512; h++) o += t[h];
        this.cksumValid = o === this.cksum, this.cksum === void 0 && o === 256 && (this.nullBlock = true);
      }
      #i(t, e = false) {
        Object.assign(this, Object.fromEntries(Object.entries(t).filter(([i, r]) => !(r == null || i === "path" && e || i === "linkpath" && e || i === "global"))));
      }
      encode(t, e = 0) {
        if (t || (t = this.block = Buffer.alloc(512)), this.#t === "Unsupported" && (this.#t = "0"), !(t.length >= e + 512)) throw new Error("need 512 bytes for header");
        let i = this.ctime || this.atime ? 130 : 155, r = an(this.path || "", i), n = r[0], o = r[1];
        this.needPax = !!r[2], this.needPax = xt(t, e, 100, n) || this.needPax, this.needPax = lt(t, e + 100, 8, this.mode) || this.needPax, this.needPax = lt(t, e + 108, 8, this.uid) || this.needPax, this.needPax = lt(t, e + 116, 8, this.gid) || this.needPax, this.needPax = lt(t, e + 124, 12, this.size) || this.needPax, this.needPax = zi(t, e + 136, 12, this.mtime) || this.needPax, t[e + 156] = Number(this.#t.codePointAt(0)), this.needPax = xt(t, e + 157, 100, this.linkpath) || this.needPax, t.write("ustar\x0000", e + 257, 8), this.needPax = xt(t, e + 265, 32, this.uname) || this.needPax, this.needPax = xt(t, e + 297, 32, this.gname) || this.needPax, this.needPax = lt(t, e + 329, 8, this.devmaj) || this.needPax, this.needPax = lt(t, e + 337, 8, this.devmin) || this.needPax, this.needPax = xt(t, e + 345, i, o) || this.needPax, t[e + 475] !== 0 ? this.needPax = xt(t, e + 345, 155, o) || this.needPax : (this.needPax = xt(t, e + 345, 130, o) || this.needPax, this.needPax = zi(t, e + 476, 12, this.atime) || this.needPax, this.needPax = zi(t, e + 488, 12, this.ctime) || this.needPax);
        let h = 256;
        for (let a = e; a < e + 148; a++) h += t[a];
        for (let a = e + 156; a < e + 512; a++) h += t[a];
        return this.cksum = h, lt(t, e + 148, 8, this.cksum), this.cksumValid = true, this.needPax;
      }
      get type() {
        return this.#t === "Unsupported" ? this.#t : he.get(this.#t);
      }
      get typeKey() {
        return this.#t;
      }
      set type(t) {
        let e = String(Ke.get(t));
        if (oe(e) || e === "Unsupported") this.#t = e;
        else if (oe(t)) this.#t = t;
        else throw new TypeError("invalid entry type: " + t);
      }
    };
    an = (s3, t) => {
      let i = s3, r = "", n, o = import_node_path5.posix.parse(s3).root || ".";
      if (Buffer.byteLength(i) < 100) n = [i, r, false];
      else {
        r = import_node_path5.posix.dirname(i), i = import_node_path5.posix.basename(i);
        do
          Buffer.byteLength(i) <= 100 && Buffer.byteLength(r) <= t ? n = [i, r, false] : Buffer.byteLength(i) > 100 && Buffer.byteLength(r) <= t ? n = [i.slice(0, 99), r, true] : (i = import_node_path5.posix.join(import_node_path5.posix.basename(r), i), r = import_node_path5.posix.dirname(r));
        while (r !== o && n === void 0);
        n || (n = [s3.slice(0, 99), "", true]);
      }
      return n;
    };
    Tt = (s3, t, e) => s3.subarray(t, t + e).toString("utf8").replace(/\0.*/, "");
    Pi = (s3, t, e) => ln(at(s3, t, e));
    ln = (s3) => s3 === void 0 ? void 0 : new Date(s3 * 1e3);
    at = (s3, t, e) => Number(s3[t]) & 128 ? Bs(s3.subarray(t, t + e)) : fn(s3, t, e);
    cn = (s3) => isNaN(s3) ? void 0 : s3;
    fn = (s3, t, e) => cn(parseInt(s3.subarray(t, t + e).toString("utf8").replace(/\0.*$/, "").trim(), 8));
    dn = { 12: 8589934591, 8: 2097151 };
    lt = (s3, t, e, i) => i === void 0 ? false : i > dn[e] || i < 0 ? (Ms(i, s3.subarray(t, t + e)), true) : (un(s3, t, e, i), false);
    un = (s3, t, e, i) => s3.write(mn(i, e), t, e, "ascii");
    mn = (s3, t) => pn(Math.floor(s3).toString(8), t);
    pn = (s3, t) => (s3.length === t - 1 ? s3 : new Array(t - s3.length - 1).join("0") + s3 + " ") + "\0";
    zi = (s3, t, e, i) => i === void 0 ? false : lt(s3, t, e, i.getTime() / 1e3);
    En = new Array(156).join("\0");
    xt = (s3, t, e, i) => i === void 0 ? false : (s3.write(i + En, t, e, "utf8"), i.length !== Buffer.byteLength(i) || i.length > e);
    ct = class s {
      atime;
      mtime;
      ctime;
      charset;
      comment;
      gid;
      uid;
      gname;
      uname;
      linkpath;
      dev;
      ino;
      nlink;
      path;
      size;
      mode;
      global;
      constructor(t, e = false) {
        this.atime = t.atime, this.charset = t.charset, this.comment = t.comment, this.ctime = t.ctime, this.dev = t.dev, this.gid = t.gid, this.global = e, this.gname = t.gname, this.ino = t.ino, this.linkpath = t.linkpath, this.mtime = t.mtime, this.nlink = t.nlink, this.path = t.path, this.size = t.size, this.uid = t.uid, this.uname = t.uname;
      }
      encode() {
        let t = this.encodeBody();
        if (t === "") return Buffer.allocUnsafe(0);
        let e = Buffer.byteLength(t), i = 512 * Math.ceil(1 + e / 512), r = Buffer.allocUnsafe(i);
        for (let n = 0; n < 512; n++) r[n] = 0;
        new F({ path: ("PaxHeader/" + (0, import_node_path6.basename)(this.path ?? "")).slice(0, 99), mode: this.mode || 420, uid: this.uid, gid: this.gid, size: e, mtime: this.mtime, type: this.global ? "GlobalExtendedHeader" : "ExtendedHeader", linkpath: "", uname: this.uname || "", gname: this.gname || "", devmaj: 0, devmin: 0, atime: this.atime, ctime: this.ctime }).encode(r), r.write(t, 512, e, "utf8");
        for (let n = e + 512; n < r.length; n++) r[n] = 0;
        return r;
      }
      encodeBody() {
        return this.encodeField("path") + this.encodeField("ctime") + this.encodeField("atime") + this.encodeField("dev") + this.encodeField("ino") + this.encodeField("nlink") + this.encodeField("charset") + this.encodeField("comment") + this.encodeField("gid") + this.encodeField("gname") + this.encodeField("linkpath") + this.encodeField("mtime") + this.encodeField("size") + this.encodeField("uid") + this.encodeField("uname");
      }
      encodeField(t) {
        if (this[t] === void 0) return "";
        let e = this[t], i = e instanceof Date ? e.getTime() / 1e3 : e, r = " " + (t === "dev" || t === "ino" || t === "nlink" ? "SCHILY." : "") + t + "=" + i + `
`, n = Buffer.byteLength(r), o = Math.floor(Math.log(n) / Math.log(10)) + 1;
        return n + o >= Math.pow(10, o) && (o += 1), o + n + r;
      }
      static parse(t, e, i = false) {
        return new s(Sn(yn(t), e), i);
      }
    };
    Sn = (s3, t) => t ? Object.assign({}, t, s3) : s3;
    yn = (s3) => s3.replace(/\n$/, "").split(`
`).reduce(Rn, /* @__PURE__ */ Object.create(null));
    Rn = (s3, t) => {
      let e = parseInt(t, 10);
      if (e !== Buffer.byteLength(t) + 1) return s3;
      t = t.slice((e + " ").length);
      let i = t.split("="), r = i.shift();
      if (!r) return s3;
      let n = r.replace(/^SCHILY\.(dev|ino|nlink)/, "$1"), o = i.join("=");
      return s3[n] = /^([A-Z]+\.)?([mac]|birth|creation)time$/.test(n) ? new Date(Number(o) * 1e3) : /^[0-9]+$/.test(o) ? +o : o, s3;
    };
    bn = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform;
    f = bn !== "win32" ? (s3) => s3 : (s3) => s3 && s3.replaceAll(/\\/g, "/");
    Yt = class extends D {
      extended;
      globalExtended;
      header;
      startBlockSize;
      blockRemain;
      remain;
      type;
      meta = false;
      ignore = false;
      path;
      mode;
      uid;
      gid;
      uname;
      gname;
      size = 0;
      mtime;
      atime;
      ctime;
      linkpath;
      dev;
      ino;
      nlink;
      invalid = false;
      absolute;
      unsupported = false;
      constructor(t, e, i) {
        switch (super({}), this.pause(), this.extended = e, this.globalExtended = i, this.header = t, this.remain = t.size ?? 0, this.startBlockSize = 512 * Math.ceil(this.remain / 512), this.blockRemain = this.startBlockSize, this.type = t.type, this.type) {
          case "File":
          case "OldFile":
          case "Link":
          case "SymbolicLink":
          case "CharacterDevice":
          case "BlockDevice":
          case "Directory":
          case "FIFO":
          case "ContiguousFile":
          case "GNUDumpDir":
            break;
          case "NextFileHasLongLinkpath":
          case "NextFileHasLongPath":
          case "OldGnuLongPath":
          case "GlobalExtendedHeader":
          case "ExtendedHeader":
          case "OldExtendedHeader":
            this.meta = true;
            break;
          default:
            this.ignore = true;
        }
        if (!t.path) throw new Error("no path provided for tar.ReadEntry");
        this.path = f(t.path), this.mode = t.mode, this.mode && (this.mode = this.mode & 4095), this.uid = t.uid, this.gid = t.gid, this.uname = t.uname, this.gname = t.gname, this.size = this.remain, this.mtime = t.mtime, this.atime = t.atime, this.ctime = t.ctime, this.linkpath = t.linkpath ? f(t.linkpath) : void 0, this.uname = t.uname, this.gname = t.gname, e && this.#t(e), i && this.#t(i, true);
      }
      write(t) {
        let e = t.length;
        if (e > this.blockRemain) throw new Error("writing more to entry than is appropriate");
        let i = this.remain, r = this.blockRemain;
        return this.remain = Math.max(0, i - e), this.blockRemain = Math.max(0, r - e), this.ignore ? true : i >= e ? super.write(t) : super.write(t.subarray(0, i));
      }
      #t(t, e = false) {
        t.path && (t.path = f(t.path)), t.linkpath && (t.linkpath = f(t.linkpath)), Object.assign(this, Object.fromEntries(Object.entries(t).filter(([i, r]) => !(r == null || i === "path" && e))));
      }
    };
    Lt = (s3, t, e, i = {}) => {
      s3.file && (i.file = s3.file), s3.cwd && (i.cwd = s3.cwd), i.code = e instanceof Error && e.code || t, i.tarCode = t, !s3.strict && i.recoverable !== false ? (e instanceof Error && (i = Object.assign(e, i), e = e.message), s3.emit("warn", t, e, i)) : e instanceof Error ? s3.emit("error", Object.assign(e, i)) : s3.emit("error", Object.assign(new Error(`${t}: ${e}`), i));
    };
    gn = 1024 * 1024;
    Zi = Buffer.from([31, 139]);
    Yi = Buffer.from([40, 181, 47, 253]);
    On = Math.max(Zi.length, Yi.length);
    B = Symbol("state");
    Nt = Symbol("writeEntry");
    et = Symbol("readEntry");
    Ui = Symbol("nextEntry");
    Us = Symbol("processEntry");
    V = Symbol("extendedHeader");
    ae = Symbol("globalExtendedHeader");
    ft = Symbol("meta");
    Hs = Symbol("emitMeta");
    p = Symbol("buffer");
    it = Symbol("queue");
    dt = Symbol("ended");
    Hi = Symbol("emittedEnd");
    At = Symbol("emit");
    y = Symbol("unzip");
    Ve = Symbol("consumeChunk");
    $e = Symbol("consumeChunkSub");
    Wi = Symbol("consumeBody");
    Ws = Symbol("consumeMeta");
    Gs = Symbol("consumeHeader");
    le = Symbol("consuming");
    Gi = Symbol("bufferConcat");
    Xe = Symbol("maybeEnd");
    Kt = Symbol("writing");
    ut = Symbol("aborted");
    qe = Symbol("onDone");
    Dt = Symbol("sawValidEntry");
    je = Symbol("sawNullBlock");
    Qe = Symbol("sawEOF");
    Zs = Symbol("closeStream");
    Tn = () => true;
    st = class extends import_events2.EventEmitter {
      file;
      strict;
      maxMetaEntrySize;
      filter;
      brotli;
      zstd;
      writable = true;
      readable = false;
      [it] = [];
      [p];
      [et];
      [Nt];
      [B] = "begin";
      [ft] = "";
      [V];
      [ae];
      [dt] = false;
      [y];
      [ut] = false;
      [Dt];
      [je] = false;
      [Qe] = false;
      [Kt] = false;
      [le] = false;
      [Hi] = false;
      constructor(t = {}) {
        super(), this.file = t.file || "", this.on(qe, () => {
          (this[B] === "begin" || this[Dt] === false) && this.warn("TAR_BAD_ARCHIVE", "Unrecognized archive format");
        }), t.ondone ? this.on(qe, t.ondone) : this.on(qe, () => {
          this.emit("prefinish"), this.emit("finish"), this.emit("end");
        }), this.strict = !!t.strict, this.maxMetaEntrySize = t.maxMetaEntrySize || gn, this.filter = typeof t.filter == "function" ? t.filter : Tn;
        let e = t.file && (t.file.endsWith(".tar.br") || t.file.endsWith(".tbr"));
        this.brotli = !(t.gzip || t.zstd) && t.brotli !== void 0 ? t.brotli : e ? void 0 : false;
        let i = t.file && (t.file.endsWith(".tar.zst") || t.file.endsWith(".tzst"));
        this.zstd = !(t.gzip || t.brotli) && t.zstd !== void 0 ? t.zstd : i ? true : void 0, this.on("end", () => this[Zs]()), typeof t.onwarn == "function" && this.on("warn", t.onwarn), typeof t.onReadEntry == "function" && this.on("entry", t.onReadEntry);
      }
      warn(t, e, i = {}) {
        Lt(this, t, e, i);
      }
      [Gs](t, e) {
        this[Dt] === void 0 && (this[Dt] = false);
        let i;
        try {
          i = new F(t, e, this[V], this[ae]);
        } catch (r) {
          return this.warn("TAR_ENTRY_INVALID", r);
        }
        if (i.nullBlock) this[je] ? (this[Qe] = true, this[B] === "begin" && (this[B] = "header"), this[At]("eof")) : (this[je] = true, this[At]("nullBlock"));
        else if (this[je] = false, !i.cksumValid) this.warn("TAR_ENTRY_INVALID", "checksum failure", { header: i });
        else if (!i.path) this.warn("TAR_ENTRY_INVALID", "path is required", { header: i });
        else {
          let r = i.type;
          if (/^(Symbolic)?Link$/.test(r) && !i.linkpath) this.warn("TAR_ENTRY_INVALID", "linkpath required", { header: i });
          else if (!/^(Symbolic)?Link$/.test(r) && !/^(Global)?ExtendedHeader$/.test(r) && i.linkpath) this.warn("TAR_ENTRY_INVALID", "linkpath forbidden", { header: i });
          else {
            let n = this[Nt] = new Yt(i, this[V], this[ae]);
            if (!this[Dt]) if (n.remain) {
              let o = () => {
                n.invalid || (this[Dt] = true);
              };
              n.on("end", o);
            } else this[Dt] = true;
            n.meta ? n.size > this.maxMetaEntrySize ? (n.ignore = true, this[At]("ignoredEntry", n), this[B] = "ignore", n.resume()) : n.size > 0 && (this[ft] = "", n.on("data", (o) => this[ft] += o), this[B] = "meta") : (this[V] = void 0, n.ignore = n.ignore || !this.filter(n.path, n), n.ignore ? (this[At]("ignoredEntry", n), this[B] = n.remain ? "ignore" : "header", n.resume()) : (n.remain ? this[B] = "body" : (this[B] = "header", n.end()), this[et] ? this[it].push(n) : (this[it].push(n), this[Ui]())));
          }
        }
      }
      [Zs]() {
        queueMicrotask(() => this.emit("close"));
      }
      [Us](t) {
        let e = true;
        if (!t) this[et] = void 0, e = false;
        else if (Array.isArray(t)) {
          let [i, ...r] = t;
          this.emit(i, ...r);
        } else this[et] = t, this.emit("entry", t), t.emittedEnd || (t.on("end", () => this[Ui]()), e = false);
        return e;
      }
      [Ui]() {
        do
          ;
        while (this[Us](this[it].shift()));
        if (this[it].length === 0) {
          let t = this[et];
          !t || t.flowing || t.size === t.remain ? this[Kt] || this.emit("drain") : t.once("drain", () => this.emit("drain"));
        }
      }
      [Wi](t, e) {
        let i = this[Nt];
        if (!i) throw new Error("attempt to consume body without entry??");
        let r = i.blockRemain ?? 0, n = r >= t.length && e === 0 ? t : t.subarray(e, e + r);
        return i.write(n), i.blockRemain || (this[B] = "header", this[Nt] = void 0, i.end()), n.length;
      }
      [Ws](t, e) {
        let i = this[Nt], r = this[Wi](t, e);
        return !this[Nt] && i && this[Hs](i), r;
      }
      [At](t, e, i) {
        this[it].length === 0 && !this[et] ? this.emit(t, e, i) : this[it].push([t, e, i]);
      }
      [Hs](t) {
        switch (this[At]("meta", this[ft]), t.type) {
          case "ExtendedHeader":
          case "OldExtendedHeader":
            this[V] = ct.parse(this[ft], this[V], false);
            break;
          case "GlobalExtendedHeader":
            this[ae] = ct.parse(this[ft], this[ae], true);
            break;
          case "NextFileHasLongPath":
          case "OldGnuLongPath": {
            let e = this[V] ?? /* @__PURE__ */ Object.create(null);
            this[V] = e, e.path = this[ft].replace(/\0.*/, "");
            break;
          }
          case "NextFileHasLongLinkpath": {
            let e = this[V] || /* @__PURE__ */ Object.create(null);
            this[V] = e, e.linkpath = this[ft].replace(/\0.*/, "");
            break;
          }
          default:
            throw new Error("unknown meta: " + t.type);
        }
      }
      abort(t) {
        this[ut] = true, this.emit("abort", t), this.warn("TAR_ABORT", t, { recoverable: false });
      }
      write(t, e, i) {
        if (typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, typeof e == "string" ? e : "utf8")), this[ut]) return i?.(), false;
        if ((this[y] === void 0 || this.brotli === void 0 && this[y] === false) && t) {
          if (this[p] && (t = Buffer.concat([this[p], t]), this[p] = void 0), t.length < On) return this[p] = t, i?.(), true;
          for (let a = 0; this[y] === void 0 && a < Zi.length; a++) t[a] !== Zi[a] && (this[y] = false);
          let o = false;
          if (this[y] === false && this.zstd !== false) {
            o = true;
            for (let a = 0; a < Yi.length; a++) if (t[a] !== Yi[a]) {
              o = false;
              break;
            }
          }
          let h = this.brotli === void 0 && !o;
          if (this[y] === false && h) if (t.length < 512) if (this[dt]) this.brotli = true;
          else return this[p] = t, i?.(), true;
          else try {
            new F(t.subarray(0, 512)), this.brotli = false;
          } catch {
            this.brotli = true;
          }
          if (this[y] === void 0 || this[y] === false && (this.brotli || o)) {
            let a = this[dt];
            this[dt] = false, this[y] = this[y] === void 0 ? new ze({}) : o ? new Ye({}) : new We({}), this[y].on("data", (c) => this[Ve](c)), this[y].on("error", (c) => this.abort(c)), this[y].on("end", () => {
              this[dt] = true, this[Ve]();
            }), this[Kt] = true;
            let l = !!this[y][a ? "end" : "write"](t);
            return this[Kt] = false, i?.(), l;
          }
        }
        this[Kt] = true, this[y] ? this[y].write(t) : this[Ve](t), this[Kt] = false;
        let n = this[it].length > 0 ? false : this[et] ? this[et].flowing : true;
        return !n && this[it].length === 0 && this[et]?.once("drain", () => this.emit("drain")), i?.(), n;
      }
      [Gi](t) {
        t && !this[ut] && (this[p] = this[p] ? Buffer.concat([this[p], t]) : t);
      }
      [Xe]() {
        if (this[dt] && !this[Hi] && !this[ut] && !this[le]) {
          this[Hi] = true;
          let t = this[Nt];
          if (t && t.blockRemain) {
            let e = this[p] ? this[p].length : 0;
            this.warn("TAR_BAD_ARCHIVE", `Truncated input (needed ${t.blockRemain} more bytes, only ${e} available)`, { entry: t }), this[p] && t.write(this[p]), t.end();
          }
          this[At](qe);
        }
      }
      [Ve](t) {
        if (this[le] && t) this[Gi](t);
        else if (!t && !this[p]) this[Xe]();
        else if (t) {
          if (this[le] = true, this[p]) {
            this[Gi](t);
            let e = this[p];
            this[p] = void 0, this[$e](e);
          } else this[$e](t);
          for (; this[p] && this[p]?.length >= 512 && !this[ut] && !this[Qe]; ) {
            let e = this[p];
            this[p] = void 0, this[$e](e);
          }
          this[le] = false;
        }
        (!this[p] || this[dt]) && this[Xe]();
      }
      [$e](t) {
        let e = 0, i = t.length;
        for (; e + 512 <= i && !this[ut] && !this[Qe]; ) switch (this[B]) {
          case "begin":
          case "header":
            this[Gs](t, e), e += 512;
            break;
          case "ignore":
          case "body":
            e += this[Wi](t, e);
            break;
          case "meta":
            e += this[Ws](t, e);
            break;
          default:
            throw new Error("invalid state: " + this[B]);
        }
        e < i && (this[p] = this[p] ? Buffer.concat([t.subarray(e), this[p]]) : t.subarray(e));
      }
      end(t, e, i) {
        return typeof t == "function" && (i = t, e = void 0, t = void 0), typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, e)), i && this.once("finish", i), this[ut] || (this[y] ? (t && this[y].write(t), this[y].end()) : (this[dt] = true, (this.brotli === void 0 || this.zstd === void 0) && (t = t || Buffer.alloc(0)), t && this.write(t), this[Xe]())), this;
      }
    };
    mt = (s3) => {
      let t = s3.length - 1, e = -1;
      for (; t > -1 && s3.charAt(t) === "/"; ) e = t, t--;
      return e === -1 ? s3 : s3.slice(0, e);
    };
    Nn = (s3) => {
      let t = s3.onReadEntry;
      s3.onReadEntry = t ? (e) => {
        t(e), e.resume();
      } : (e) => e.resume();
    };
    Ki = (s3, t) => {
      let e = new Map(t.map((n) => [mt(n), true])), i = s3.filter, r = (n, o = "") => {
        let h = o || (0, import_path.parse)(n).root || ".", a;
        if (n === h) a = false;
        else {
          let l = e.get(n);
          a = l !== void 0 ? l : r((0, import_path.dirname)(n), h);
        }
        return e.set(n, a), a;
      };
      s3.filter = i ? (n, o) => i(n, o) && r(mt(n)) : (n) => r(mt(n));
    };
    An = (s3) => {
      let t = new st(s3), e = s3.file, i;
      try {
        i = import_node_fs2.default.openSync(e, "r");
        let r = import_node_fs2.default.fstatSync(i), n = s3.maxReadSize || 16 * 1024 * 1024;
        if (r.size < n) {
          let o = Buffer.allocUnsafe(r.size), h = import_node_fs2.default.readSync(i, o, 0, r.size, 0);
          t.end(h === o.byteLength ? o : o.subarray(0, h));
        } else {
          let o = 0, h = Buffer.allocUnsafe(n);
          for (; o < r.size; ) {
            let a = import_node_fs2.default.readSync(i, h, 0, n, o);
            if (a === 0) break;
            o += a, t.write(h.subarray(0, a));
          }
          t.end();
        }
      } finally {
        if (typeof i == "number") try {
          import_node_fs2.default.closeSync(i);
        } catch {
        }
      }
    };
    Dn = (s3, t) => {
      let e = new st(s3), i = s3.maxReadSize || 16 * 1024 * 1024, r = s3.file;
      return new Promise((o, h) => {
        e.on("error", h), e.on("end", o), import_node_fs2.default.stat(r, (a, l) => {
          if (a) h(a);
          else {
            let c = new _t(r, { readSize: i, size: l.size });
            c.on("error", h), c.pipe(e);
          }
        });
      });
    };
    It = K(An, Dn, (s3) => new st(s3), (s3) => new st(s3), (s3, t) => {
      t?.length && Ki(s3, t), s3.noResume || Nn(s3);
    });
    Vi = (s3, t, e) => (s3 &= 4095, e && (s3 = (s3 | 384) & -19), t && (s3 & 256 && (s3 |= 64), s3 & 32 && (s3 |= 8), s3 & 4 && (s3 |= 1)), s3);
    ({ isAbsolute: Cn, parse: Ys } = import_node_path7.win32);
    ce = (s3) => {
      let t = "", e = Ys(s3);
      for (; Cn(s3) || e.root; ) {
        let i = s3.charAt(0) === "/" && s3.slice(0, 4) !== "//?/" ? "/" : e.root;
        s3 = s3.slice(i.length), t += i, e = Ys(s3);
      }
      return [t, s3];
    };
    Je = ["|", "<", ">", "?", ":"];
    $i = Je.map((s3) => String.fromCodePoint(61440 + Number(s3.codePointAt(0))));
    Fn = new Map(Je.map((s3, t) => [s3, $i[t]]));
    kn = new Map($i.map((s3, t) => [s3, Je[t]]));
    Xi = (s3) => Je.reduce((t, e) => t.split(e).join(Fn.get(e)), s3);
    Ks = (s3) => $i.reduce((t, e) => t.split(e).join(kn.get(e)), s3);
    Js = (s3, t) => t ? (s3 = f(s3).replace(/^\.(\/|$)/, ""), mt(t) + "/" + s3) : f(s3);
    vn = 16 * 1024 * 1024;
    Xs = Symbol("process");
    qs = Symbol("file");
    js = Symbol("directory");
    ji = Symbol("symlink");
    Qs = Symbol("hardlink");
    fe = Symbol("header");
    ti = Symbol("read");
    Qi = Symbol("lstat");
    ei = Symbol("onlstat");
    Ji = Symbol("onread");
    ts = Symbol("onreadlink");
    es = Symbol("openfile");
    is = Symbol("onopenfile");
    pt = Symbol("close");
    ii = Symbol("mode");
    ss = Symbol("awaitDrain");
    qi = Symbol("ondrain");
    X = Symbol("prefix");
    de = class extends D {
      path;
      portable;
      myuid = process.getuid && process.getuid() || 0;
      myuser = process.env.USER || "";
      maxReadSize;
      linkCache;
      statCache;
      preservePaths;
      cwd;
      strict;
      mtime;
      noPax;
      noMtime;
      prefix;
      fd;
      blockLen = 0;
      blockRemain = 0;
      buf;
      pos = 0;
      remain = 0;
      length = 0;
      offset = 0;
      win32;
      absolute;
      header;
      type;
      linkpath;
      stat;
      onWriteEntry;
      #t = false;
      constructor(t, e = {}) {
        let i = re(e);
        super(), this.path = f(t), this.portable = !!i.portable, this.maxReadSize = i.maxReadSize || vn, this.linkCache = i.linkCache || /* @__PURE__ */ new Map(), this.statCache = i.statCache || /* @__PURE__ */ new Map(), this.preservePaths = !!i.preservePaths, this.cwd = f(i.cwd || process.cwd()), this.strict = !!i.strict, this.noPax = !!i.noPax, this.noMtime = !!i.noMtime, this.mtime = i.mtime, this.prefix = i.prefix ? f(i.prefix) : void 0, this.onWriteEntry = i.onWriteEntry, typeof i.onwarn == "function" && this.on("warn", i.onwarn);
        let r = false;
        if (!this.preservePaths) {
          let [o, h] = ce(this.path);
          o && typeof h == "string" && (this.path = h, r = o);
        }
        this.win32 = !!i.win32 || process.platform === "win32", this.win32 && (this.path = Ks(this.path.replaceAll(/\\/g, "/")), t = t.replaceAll(/\\/g, "/")), this.absolute = f(i.absolute || import_path2.default.resolve(this.cwd, t)), this.path === "" && (this.path = "./"), r && this.warn("TAR_ENTRY_INFO", `stripping ${r} from absolute path`, { entry: this, path: r + this.path });
        let n = this.statCache.get(this.absolute);
        n ? this[ei](n) : this[Qi]();
      }
      warn(t, e, i = {}) {
        return Lt(this, t, e, i);
      }
      emit(t, ...e) {
        return t === "error" && (this.#t = true), super.emit(t, ...e);
      }
      [Qi]() {
        import_fs3.default.lstat(this.absolute, (t, e) => {
          if (t) return this.emit("error", t);
          this[ei](e);
        });
      }
      [ei](t) {
        this.statCache.set(this.absolute, t), this.stat = t, t.isFile() || (t.size = 0), this.type = Mn(t), this.emit("stat", t), this[Xs]();
      }
      [Xs]() {
        switch (this.type) {
          case "File":
            return this[qs]();
          case "Directory":
            return this[js]();
          case "SymbolicLink":
            return this[ji]();
          default:
            return this.end();
        }
      }
      [ii](t) {
        return Vi(t, this.type === "Directory", this.portable);
      }
      [X](t) {
        return Js(t, this.prefix);
      }
      [fe]() {
        if (!this.stat) throw new Error("cannot write header before stat");
        this.type === "Directory" && this.portable && (this.noMtime = true), this.onWriteEntry?.(this), this.header = new F({ path: this[X](this.path), linkpath: this.type === "Link" && this.linkpath !== void 0 ? this[X](this.linkpath) : this.linkpath, mode: this[ii](this.stat.mode), uid: this.portable ? void 0 : this.stat.uid, gid: this.portable ? void 0 : this.stat.gid, size: this.stat.size, mtime: this.noMtime ? void 0 : this.mtime || this.stat.mtime, type: this.type === "Unsupported" ? void 0 : this.type, uname: this.portable ? void 0 : this.stat.uid === this.myuid ? this.myuser : "", atime: this.portable ? void 0 : this.stat.atime, ctime: this.portable ? void 0 : this.stat.ctime }), this.header.encode() && !this.noPax && super.write(new ct({ atime: this.portable ? void 0 : this.header.atime, ctime: this.portable ? void 0 : this.header.ctime, gid: this.portable ? void 0 : this.header.gid, mtime: this.noMtime ? void 0 : this.mtime || this.header.mtime, path: this[X](this.path), linkpath: this.type === "Link" && this.linkpath !== void 0 ? this[X](this.linkpath) : this.linkpath, size: this.header.size, uid: this.portable ? void 0 : this.header.uid, uname: this.portable ? void 0 : this.header.uname, dev: this.portable ? void 0 : this.stat.dev, ino: this.portable ? void 0 : this.stat.ino, nlink: this.portable ? void 0 : this.stat.nlink }).encode());
        let t = this.header?.block;
        if (!t) throw new Error("failed to encode header");
        super.write(t);
      }
      [js]() {
        if (!this.stat) throw new Error("cannot create directory entry without stat");
        this.path.slice(-1) !== "/" && (this.path += "/"), this.stat.size = 0, this[fe](), this.end();
      }
      [ji]() {
        import_fs3.default.readlink(this.absolute, (t, e) => {
          if (t) return this.emit("error", t);
          this[ts](e);
        });
      }
      [ts](t) {
        this.linkpath = f(t), this[fe](), this.end();
      }
      [Qs](t) {
        if (!this.stat) throw new Error("cannot create link entry without stat");
        this.type = "Link", this.linkpath = f(import_path2.default.relative(this.cwd, t)), this.stat.size = 0, this[fe](), this.end();
      }
      [qs]() {
        if (!this.stat) throw new Error("cannot create file entry without stat");
        if (this.stat.nlink > 1) {
          let t = `${this.stat.dev}:${this.stat.ino}`, e = this.linkCache.get(t);
          if (e?.indexOf(this.cwd) === 0) return this[Qs](e);
          this.linkCache.set(t, this.absolute);
        }
        if (this[fe](), this.stat.size === 0) return this.end();
        this[es]();
      }
      [es]() {
        import_fs3.default.open(this.absolute, "r", (t, e) => {
          if (t) return this.emit("error", t);
          this[is](e);
        });
      }
      [is](t) {
        if (this.fd = t, this.#t) return this[pt]();
        if (!this.stat) throw new Error("should stat before calling onopenfile");
        this.blockLen = 512 * Math.ceil(this.stat.size / 512), this.blockRemain = this.blockLen;
        let e = Math.min(this.blockLen, this.maxReadSize);
        this.buf = Buffer.allocUnsafe(e), this.offset = 0, this.pos = 0, this.remain = this.stat.size, this.length = this.buf.length, this[ti]();
      }
      [ti]() {
        let { fd: t, buf: e, offset: i, length: r, pos: n } = this;
        if (t === void 0 || e === void 0) throw new Error("cannot read file without first opening");
        import_fs3.default.read(t, e, i, r, n, (o, h) => {
          if (o) return this[pt](() => this.emit("error", o));
          this[Ji](h);
        });
      }
      [pt](t = () => {
      }) {
        this.fd !== void 0 && import_fs3.default.close(this.fd, t);
      }
      [Ji](t) {
        if (t <= 0 && this.remain > 0) {
          let r = Object.assign(new Error("encountered unexpected EOF"), { path: this.absolute, syscall: "read", code: "EOF" });
          return this[pt](() => this.emit("error", r));
        }
        if (t > this.remain) {
          let r = Object.assign(new Error("did not encounter expected EOF"), { path: this.absolute, syscall: "read", code: "EOF" });
          return this[pt](() => this.emit("error", r));
        }
        if (!this.buf) throw new Error("should have created buffer prior to reading");
        if (t === this.remain) for (let r = t; r < this.length && t < this.blockRemain; r++) this.buf[r + this.offset] = 0, t++, this.remain++;
        let e = this.offset === 0 && t === this.buf.length ? this.buf : this.buf.subarray(this.offset, this.offset + t);
        this.write(e) ? this[qi]() : this[ss](() => this[qi]());
      }
      [ss](t) {
        this.once("drain", t);
      }
      write(t, e, i) {
        if (typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, typeof e == "string" ? e : "utf8")), this.blockRemain < t.length) {
          let r = Object.assign(new Error("writing more data than expected"), { path: this.absolute });
          return this.emit("error", r);
        }
        return this.remain -= t.length, this.blockRemain -= t.length, this.pos += t.length, this.offset += t.length, super.write(t, null, i);
      }
      [qi]() {
        if (!this.remain) return this.blockRemain && super.write(Buffer.alloc(this.blockRemain)), this[pt]((t) => t ? this.emit("error", t) : this.end());
        if (!this.buf) throw new Error("buffer lost somehow in ONDRAIN");
        this.offset >= this.length && (this.buf = Buffer.allocUnsafe(Math.min(this.blockRemain, this.buf.length)), this.offset = 0), this.length = this.buf.length - this.offset, this[ti]();
      }
    };
    si = class extends de {
      sync = true;
      [Qi]() {
        this[ei](import_fs3.default.lstatSync(this.absolute));
      }
      [ji]() {
        this[ts](import_fs3.default.readlinkSync(this.absolute));
      }
      [es]() {
        this[is](import_fs3.default.openSync(this.absolute, "r"));
      }
      [ti]() {
        let t = true;
        try {
          let { fd: e, buf: i, offset: r, length: n, pos: o } = this;
          if (e === void 0 || i === void 0) throw new Error("fd and buf must be set in READ method");
          let h = import_fs3.default.readSync(e, i, r, n, o);
          this[Ji](h), t = false;
        } finally {
          if (t) try {
            this[pt](() => {
            });
          } catch {
          }
        }
      }
      [ss](t) {
        t();
      }
      [pt](t = () => {
      }) {
        this.fd !== void 0 && import_fs3.default.closeSync(this.fd), t();
      }
    };
    ri = class extends D {
      blockLen = 0;
      blockRemain = 0;
      buf = 0;
      pos = 0;
      remain = 0;
      length = 0;
      preservePaths;
      portable;
      strict;
      noPax;
      noMtime;
      readEntry;
      type;
      prefix;
      path;
      mode;
      uid;
      gid;
      uname;
      gname;
      header;
      mtime;
      atime;
      ctime;
      linkpath;
      size;
      onWriteEntry;
      warn(t, e, i = {}) {
        return Lt(this, t, e, i);
      }
      constructor(t, e = {}) {
        let i = re(e);
        super(), this.preservePaths = !!i.preservePaths, this.portable = !!i.portable, this.strict = !!i.strict, this.noPax = !!i.noPax, this.noMtime = !!i.noMtime, this.onWriteEntry = i.onWriteEntry, this.readEntry = t;
        let { type: r } = t;
        if (r === "Unsupported") throw new Error("writing entry that should be ignored");
        this.type = r, this.type === "Directory" && this.portable && (this.noMtime = true), this.prefix = i.prefix, this.path = f(t.path), this.mode = t.mode !== void 0 ? this[ii](t.mode) : void 0, this.uid = this.portable ? void 0 : t.uid, this.gid = this.portable ? void 0 : t.gid, this.uname = this.portable ? void 0 : t.uname, this.gname = this.portable ? void 0 : t.gname, this.size = t.size, this.mtime = this.noMtime ? void 0 : i.mtime || t.mtime, this.atime = this.portable ? void 0 : t.atime, this.ctime = this.portable ? void 0 : t.ctime, this.linkpath = t.linkpath !== void 0 ? f(t.linkpath) : void 0, typeof i.onwarn == "function" && this.on("warn", i.onwarn);
        let n = false;
        if (!this.preservePaths) {
          let [h, a] = ce(this.path);
          h && typeof a == "string" && (this.path = a, n = h);
        }
        this.remain = t.size, this.blockRemain = t.startBlockSize, this.onWriteEntry?.(this), this.header = new F({ path: this[X](this.path), linkpath: this.type === "Link" && this.linkpath !== void 0 ? this[X](this.linkpath) : this.linkpath, mode: this.mode, uid: this.portable ? void 0 : this.uid, gid: this.portable ? void 0 : this.gid, size: this.size, mtime: this.noMtime ? void 0 : this.mtime, type: this.type, uname: this.portable ? void 0 : this.uname, atime: this.portable ? void 0 : this.atime, ctime: this.portable ? void 0 : this.ctime }), n && this.warn("TAR_ENTRY_INFO", `stripping ${n} from absolute path`, { entry: this, path: n + this.path }), this.header.encode() && !this.noPax && super.write(new ct({ atime: this.portable ? void 0 : this.atime, ctime: this.portable ? void 0 : this.ctime, gid: this.portable ? void 0 : this.gid, mtime: this.noMtime ? void 0 : this.mtime, path: this[X](this.path), linkpath: this.type === "Link" && this.linkpath !== void 0 ? this[X](this.linkpath) : this.linkpath, size: this.size, uid: this.portable ? void 0 : this.uid, uname: this.portable ? void 0 : this.uname, dev: this.portable ? void 0 : this.readEntry.dev, ino: this.portable ? void 0 : this.readEntry.ino, nlink: this.portable ? void 0 : this.readEntry.nlink }).encode());
        let o = this.header?.block;
        if (!o) throw new Error("failed to encode header");
        super.write(o), t.pipe(this);
      }
      [X](t) {
        return Js(t, this.prefix);
      }
      [ii](t) {
        return Vi(t, this.type === "Directory", this.portable);
      }
      write(t, e, i) {
        typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, typeof e == "string" ? e : "utf8"));
        let r = t.length;
        if (r > this.blockRemain) throw new Error("writing more to entry than is appropriate");
        return this.blockRemain -= r, super.write(t, i);
      }
      end(t, e, i) {
        return this.blockRemain && super.write(Buffer.alloc(this.blockRemain)), typeof t == "function" && (i = t, e = void 0, t = void 0), typeof e == "function" && (i = e, e = void 0), typeof t == "string" && (t = Buffer.from(t, e ?? "utf8")), i && this.once("finish", i), t ? super.end(t, i) : super.end(i), this;
      }
    };
    Mn = (s3) => s3.isFile() ? "File" : s3.isDirectory() ? "Directory" : s3.isSymbolicLink() ? "SymbolicLink" : "Unsupported";
    ni = class s2 {
      tail;
      head;
      length = 0;
      static create(t = []) {
        return new s2(t);
      }
      constructor(t = []) {
        for (let e of t) this.push(e);
      }
      *[Symbol.iterator]() {
        for (let t = this.head; t; t = t.next) yield t.value;
      }
      removeNode(t) {
        if (t.list !== this) throw new Error("removing node which does not belong to this list");
        let e = t.next, i = t.prev;
        return e && (e.prev = i), i && (i.next = e), t === this.head && (this.head = e), t === this.tail && (this.tail = i), this.length--, t.next = void 0, t.prev = void 0, t.list = void 0, e;
      }
      unshiftNode(t) {
        if (t === this.head) return;
        t.list && t.list.removeNode(t);
        let e = this.head;
        t.list = this, t.next = e, e && (e.prev = t), this.head = t, this.tail || (this.tail = t), this.length++;
      }
      pushNode(t) {
        if (t === this.tail) return;
        t.list && t.list.removeNode(t);
        let e = this.tail;
        t.list = this, t.prev = e, e && (e.next = t), this.tail = t, this.head || (this.head = t), this.length++;
      }
      push(...t) {
        for (let e = 0, i = t.length; e < i; e++) Pn(this, t[e]);
        return this.length;
      }
      unshift(...t) {
        for (var e = 0, i = t.length; e < i; e++) zn(this, t[e]);
        return this.length;
      }
      pop() {
        if (!this.tail) return;
        let t = this.tail.value, e = this.tail;
        return this.tail = this.tail.prev, this.tail ? this.tail.next = void 0 : this.head = void 0, e.list = void 0, this.length--, t;
      }
      shift() {
        if (!this.head) return;
        let t = this.head.value, e = this.head;
        return this.head = this.head.next, this.head ? this.head.prev = void 0 : this.tail = void 0, e.list = void 0, this.length--, t;
      }
      forEach(t, e) {
        e = e || this;
        for (let i = this.head, r = 0; i; r++) t.call(e, i.value, r, this), i = i.next;
      }
      forEachReverse(t, e) {
        e = e || this;
        for (let i = this.tail, r = this.length - 1; i; r--) t.call(e, i.value, r, this), i = i.prev;
      }
      get(t) {
        let e = 0, i = this.head;
        for (; i && e < t; e++) i = i.next;
        if (e === t && i) return i.value;
      }
      getReverse(t) {
        let e = 0, i = this.tail;
        for (; i && e < t; e++) i = i.prev;
        if (e === t && i) return i.value;
      }
      map(t, e) {
        e = e || this;
        let i = new s2();
        for (let r = this.head; r; ) i.push(t.call(e, r.value, this)), r = r.next;
        return i;
      }
      mapReverse(t, e) {
        e = e || this;
        var i = new s2();
        for (let r = this.tail; r; ) i.push(t.call(e, r.value, this)), r = r.prev;
        return i;
      }
      reduce(t, e) {
        let i, r = this.head;
        if (arguments.length > 1) i = e;
        else if (this.head) r = this.head.next, i = this.head.value;
        else throw new TypeError("Reduce of empty list with no initial value");
        for (var n = 0; r; n++) i = t(i, r.value, n), r = r.next;
        return i;
      }
      reduceReverse(t, e) {
        let i, r = this.tail;
        if (arguments.length > 1) i = e;
        else if (this.tail) r = this.tail.prev, i = this.tail.value;
        else throw new TypeError("Reduce of empty list with no initial value");
        for (let n = this.length - 1; r; n--) i = t(i, r.value, n), r = r.prev;
        return i;
      }
      toArray() {
        let t = new Array(this.length);
        for (let e = 0, i = this.head; i; e++) t[e] = i.value, i = i.next;
        return t;
      }
      toArrayReverse() {
        let t = new Array(this.length);
        for (let e = 0, i = this.tail; i; e++) t[e] = i.value, i = i.prev;
        return t;
      }
      slice(t = 0, e = this.length) {
        e < 0 && (e += this.length), t < 0 && (t += this.length);
        let i = new s2();
        if (e < t || e < 0) return i;
        t < 0 && (t = 0), e > this.length && (e = this.length);
        let r = this.head, n = 0;
        for (n = 0; r && n < t; n++) r = r.next;
        for (; r && n < e; n++, r = r.next) i.push(r.value);
        return i;
      }
      sliceReverse(t = 0, e = this.length) {
        e < 0 && (e += this.length), t < 0 && (t += this.length);
        let i = new s2();
        if (e < t || e < 0) return i;
        t < 0 && (t = 0), e > this.length && (e = this.length);
        let r = this.length, n = this.tail;
        for (; n && r > e; r--) n = n.prev;
        for (; n && r > t; r--, n = n.prev) i.push(n.value);
        return i;
      }
      splice(t, e = 0, ...i) {
        t > this.length && (t = this.length - 1), t < 0 && (t = this.length + t);
        let r = this.head;
        for (let o = 0; r && o < t; o++) r = r.next;
        let n = [];
        for (let o = 0; r && o < e; o++) n.push(r.value), r = this.removeNode(r);
        r ? r !== this.tail && (r = r.prev) : r = this.tail;
        for (let o of i) r = Bn(this, r, o);
        return n;
      }
      reverse() {
        let t = this.head, e = this.tail;
        for (let i = t; i; i = i.prev) {
          let r = i.prev;
          i.prev = i.next, i.next = r;
        }
        return this.head = e, this.tail = t, this;
      }
    };
    ue = class {
      list;
      next;
      prev;
      value;
      constructor(t, e, i, r) {
        this.list = r, this.value = t, e ? (e.next = this, this.prev = e) : this.prev = void 0, i ? (i.prev = this, this.next = i) : this.next = void 0;
      }
    };
    di = class {
      path;
      absolute;
      entry;
      stat;
      readdir;
      pending = false;
      ignore = false;
      piped = false;
      constructor(t, e) {
        this.path = t || "./", this.absolute = e;
      }
    };
    tr = Buffer.alloc(1024);
    oi = Symbol("onStat");
    me = Symbol("ended");
    W = Symbol("queue");
    Ct = Symbol("current");
    Ft = Symbol("process");
    pe = Symbol("processing");
    rs = Symbol("processJob");
    G = Symbol("jobs");
    ns = Symbol("jobDone");
    hi = Symbol("addFSEntry");
    er = Symbol("addTarEntry");
    as = Symbol("stat");
    ls = Symbol("readdir");
    ai = Symbol("onreaddir");
    li = Symbol("pipe");
    ir = Symbol("entry");
    os = Symbol("entryOpt");
    ci = Symbol("writeEntryClass");
    rr = Symbol("write");
    hs = Symbol("ondrain");
    Et = class extends D {
      sync = false;
      opt;
      cwd;
      maxReadSize;
      preservePaths;
      strict;
      noPax;
      prefix;
      linkCache;
      statCache;
      file;
      portable;
      zip;
      readdirCache;
      noDirRecurse;
      follow;
      noMtime;
      mtime;
      filter;
      jobs;
      [ci];
      onWriteEntry;
      [W];
      [G] = 0;
      [pe] = false;
      [me] = false;
      constructor(t = {}) {
        if (super(), this.opt = t, this.file = t.file || "", this.cwd = t.cwd || process.cwd(), this.maxReadSize = t.maxReadSize, this.preservePaths = !!t.preservePaths, this.strict = !!t.strict, this.noPax = !!t.noPax, this.prefix = f(t.prefix || ""), this.linkCache = t.linkCache || /* @__PURE__ */ new Map(), this.statCache = t.statCache || /* @__PURE__ */ new Map(), this.readdirCache = t.readdirCache || /* @__PURE__ */ new Map(), this.onWriteEntry = t.onWriteEntry, this[ci] = de, typeof t.onwarn == "function" && this.on("warn", t.onwarn), this.portable = !!t.portable, t.gzip || t.brotli || t.zstd) {
          if ((t.gzip ? 1 : 0) + (t.brotli ? 1 : 0) + (t.zstd ? 1 : 0) > 1) throw new TypeError("gzip, brotli, zstd are mutually exclusive");
          if (t.gzip && (typeof t.gzip != "object" && (t.gzip = {}), this.portable && (t.gzip.portable = true), this.zip = new Pe(t.gzip)), t.brotli && (typeof t.brotli != "object" && (t.brotli = {}), this.zip = new He(t.brotli)), t.zstd && (typeof t.zstd != "object" && (t.zstd = {}), this.zip = new Ze(t.zstd)), !this.zip) throw new Error("impossible");
          let e = this.zip;
          e.on("data", (i) => super.write(i)), e.on("end", () => super.end()), e.on("drain", () => this[hs]()), this.on("resume", () => e.resume());
        } else this.on("drain", this[hs]);
        this.noDirRecurse = !!t.noDirRecurse, this.follow = !!t.follow, this.noMtime = !!t.noMtime, t.mtime && (this.mtime = t.mtime), this.filter = typeof t.filter == "function" ? t.filter : () => true, this[W] = new ni(), this[G] = 0, this.jobs = Number(t.jobs) || 4, this[pe] = false, this[me] = false;
      }
      [rr](t) {
        return super.write(t);
      }
      add(t) {
        return this.write(t), this;
      }
      end(t, e, i) {
        return typeof t == "function" && (i = t, t = void 0), typeof e == "function" && (i = e, e = void 0), t && this.add(t), this[me] = true, this[Ft](), i && i(), this;
      }
      write(t) {
        if (this[me]) throw new Error("write after end");
        return t instanceof Yt ? this[er](t) : this[hi](t), this.flowing;
      }
      [er](t) {
        let e = f(import_path3.default.resolve(this.cwd, t.path));
        if (!this.filter(t.path, t)) t.resume();
        else {
          let i = new di(t.path, e);
          i.entry = new ri(t, this[os](i)), i.entry.on("end", () => this[ns](i)), this[G] += 1, this[W].push(i);
        }
        this[Ft]();
      }
      [hi](t) {
        let e = f(import_path3.default.resolve(this.cwd, t));
        this[W].push(new di(t, e)), this[Ft]();
      }
      [as](t) {
        t.pending = true, this[G] += 1;
        let e = this.follow ? "stat" : "lstat";
        import_fs2.default[e](t.absolute, (i, r) => {
          t.pending = false, this[G] -= 1, i ? this.emit("error", i) : this[oi](t, r);
        });
      }
      [oi](t, e) {
        this.statCache.set(t.absolute, e), t.stat = e, this.filter(t.path, e) ? e.isFile() && e.nlink > 1 && t === this[Ct] && !this.linkCache.get(`${e.dev}:${e.ino}`) && !this.sync && this[rs](t) : t.ignore = true, this[Ft]();
      }
      [ls](t) {
        t.pending = true, this[G] += 1, import_fs2.default.readdir(t.absolute, (e, i) => {
          if (t.pending = false, this[G] -= 1, e) return this.emit("error", e);
          this[ai](t, i);
        });
      }
      [ai](t, e) {
        this.readdirCache.set(t.absolute, e), t.readdir = e, this[Ft]();
      }
      [Ft]() {
        if (!this[pe]) {
          this[pe] = true;
          for (let t = this[W].head; t && this[G] < this.jobs; t = t.next) if (this[rs](t.value), t.value.ignore) {
            let e = t.next;
            this[W].removeNode(t), t.next = e;
          }
          this[pe] = false, this[me] && this[W].length === 0 && this[G] === 0 && (this.zip ? this.zip.end(tr) : (super.write(tr), super.end()));
        }
      }
      get [Ct]() {
        return this[W] && this[W].head && this[W].head.value;
      }
      [ns](t) {
        this[W].shift(), this[G] -= 1, this[Ft]();
      }
      [rs](t) {
        if (!t.pending) {
          if (t.entry) {
            t === this[Ct] && !t.piped && this[li](t);
            return;
          }
          if (!t.stat) {
            let e = this.statCache.get(t.absolute);
            e ? this[oi](t, e) : this[as](t);
          }
          if (t.stat && !t.ignore) {
            if (!this.noDirRecurse && t.stat.isDirectory() && !t.readdir) {
              let e = this.readdirCache.get(t.absolute);
              if (e ? this[ai](t, e) : this[ls](t), !t.readdir) return;
            }
            if (t.entry = this[ir](t), !t.entry) {
              t.ignore = true;
              return;
            }
            t === this[Ct] && !t.piped && this[li](t);
          }
        }
      }
      [os](t) {
        return { onwarn: (e, i, r) => this.warn(e, i, r), noPax: this.noPax, cwd: this.cwd, absolute: t.absolute, preservePaths: this.preservePaths, maxReadSize: this.maxReadSize, strict: this.strict, portable: this.portable, linkCache: this.linkCache, statCache: this.statCache, noMtime: this.noMtime, mtime: this.mtime, prefix: this.prefix, onWriteEntry: this.onWriteEntry };
      }
      [ir](t) {
        this[G] += 1;
        try {
          return new this[ci](t.path, this[os](t)).on("end", () => this[ns](t)).on("error", (i) => this.emit("error", i));
        } catch (e) {
          this.emit("error", e);
        }
      }
      [hs]() {
        this[Ct] && this[Ct].entry && this[Ct].entry.resume();
      }
      [li](t) {
        t.piped = true, t.readdir && t.readdir.forEach((r) => {
          let n = t.path, o = n === "./" ? "" : n.replace(/\/*$/, "/");
          this[hi](o + r);
        });
        let e = t.entry, i = this.zip;
        if (!e) throw new Error("cannot pipe without source");
        i ? e.on("data", (r) => {
          i.write(r) || e.pause();
        }) : e.on("data", (r) => {
          super.write(r) || e.pause();
        });
      }
      pause() {
        return this.zip && this.zip.pause(), super.pause();
      }
      warn(t, e, i = {}) {
        Lt(this, t, e, i);
      }
    };
    kt = class extends Et {
      sync = true;
      constructor(t) {
        super(t), this[ci] = si;
      }
      pause() {
      }
      resume() {
      }
      [as](t) {
        let e = this.follow ? "statSync" : "lstatSync";
        this[oi](t, import_fs2.default[e](t.absolute));
      }
      [ls](t) {
        this[ai](t, import_fs2.default.readdirSync(t.absolute));
      }
      [li](t) {
        let e = t.entry, i = this.zip;
        if (t.readdir && t.readdir.forEach((r) => {
          let n = t.path, o = n === "./" ? "" : n.replace(/\/*$/, "/");
          this[hi](o + r);
        }), !e) throw new Error("Cannot pipe without source");
        i ? e.on("data", (r) => {
          i.write(r);
        }) : e.on("data", (r) => {
          super[rr](r);
        });
      }
    };
    Un = (s3, t) => {
      let e = new kt(s3), i = new Wt(s3.file, { mode: s3.mode || 438 });
      e.pipe(i), or(e, t);
    };
    Hn = (s3, t) => {
      let e = new Et(s3), i = new tt(s3.file, { mode: s3.mode || 438 });
      e.pipe(i);
      let r = new Promise((n, o) => {
        i.on("error", o), i.on("close", n), e.on("error", o);
      });
      return hr(e, t).catch((n) => e.emit("error", n)), r;
    };
    or = (s3, t) => {
      t.forEach((e) => {
        e.charAt(0) === "@" ? It({ file: import_node_path4.default.resolve(s3.cwd, e.slice(1)), sync: true, noResume: true, onReadEntry: (i) => s3.add(i) }) : s3.add(e);
      }), s3.end();
    };
    hr = async (s3, t) => {
      for (let e of t) e.charAt(0) === "@" ? await It({ file: import_node_path4.default.resolve(String(s3.cwd), e.slice(1)), noResume: true, onReadEntry: (i) => {
        s3.add(i);
      } }) : s3.add(e);
      s3.end();
    };
    Wn = (s3, t) => {
      let e = new kt(s3);
      return or(e, t), e;
    };
    Gn = (s3, t) => {
      let e = new Et(s3);
      return hr(e, t).catch((i) => e.emit("error", i)), e;
    };
    Zn = K(Un, Hn, Wn, Gn, (s3, t) => {
      if (!t?.length) throw new TypeError("no paths specified to add to archive");
    });
    Yn = process.env.__FAKE_PLATFORM__ || process.platform;
    fr = Yn === "win32";
    ({ O_CREAT: dr, O_NOFOLLOW: ar, O_TRUNC: ur, O_WRONLY: mr } = import_fs4.default.constants);
    pr = Number(process.env.__FAKE_FS_O_FILENAME__) || import_fs4.default.constants.UV_FS_O_FILEMAP || 0;
    Kn = fr && !!pr;
    Vn = 512 * 1024;
    $n = pr | ur | dr | mr;
    lr = !fr && typeof ar == "number" ? ar | ur | dr | mr : null;
    cs = lr !== null ? () => lr : Kn ? (s3) => s3 < Vn ? $n : "w" : () => "w";
    fs2 = (s3, t, e) => {
      try {
        return import_node_fs5.default.lchownSync(s3, t, e);
      } catch (i) {
        if (i?.code !== "ENOENT") throw i;
      }
    };
    ui = (s3, t, e, i) => {
      import_node_fs5.default.lchown(s3, t, e, (r) => {
        i(r && r?.code !== "ENOENT" ? r : null);
      });
    };
    Xn = (s3, t, e, i, r) => {
      if (t.isDirectory()) ds(import_node_path9.default.resolve(s3, t.name), e, i, (n) => {
        if (n) return r(n);
        let o = import_node_path9.default.resolve(s3, t.name);
        ui(o, e, i, r);
      });
      else {
        let n = import_node_path9.default.resolve(s3, t.name);
        ui(n, e, i, r);
      }
    };
    ds = (s3, t, e, i) => {
      import_node_fs5.default.readdir(s3, { withFileTypes: true }, (r, n) => {
        if (r) {
          if (r.code === "ENOENT") return i();
          if (r.code !== "ENOTDIR" && r.code !== "ENOTSUP") return i(r);
        }
        if (r || !n.length) return ui(s3, t, e, i);
        let o = n.length, h = null, a = (l) => {
          if (!h) {
            if (l) return i(h = l);
            if (--o === 0) return ui(s3, t, e, i);
          }
        };
        for (let l of n) Xn(s3, l, t, e, a);
      });
    };
    qn = (s3, t, e, i) => {
      t.isDirectory() && us(import_node_path9.default.resolve(s3, t.name), e, i), fs2(import_node_path9.default.resolve(s3, t.name), e, i);
    };
    us = (s3, t, e) => {
      let i;
      try {
        i = import_node_fs5.default.readdirSync(s3, { withFileTypes: true });
      } catch (r) {
        let n = r;
        if (n?.code === "ENOENT") return;
        if (n?.code === "ENOTDIR" || n?.code === "ENOTSUP") return fs2(s3, t, e);
        throw n;
      }
      for (let r of i) qn(s3, r, t, e);
      return fs2(s3, t, e);
    };
    we = class extends Error {
      path;
      code;
      syscall = "chdir";
      constructor(t, e) {
        super(`${e}: Cannot cd into '${t}'`), this.path = t, this.code = e;
      }
      get name() {
        return "CwdError";
      }
    };
    wt = class extends Error {
      path;
      symlink;
      syscall = "symlink";
      code = "TAR_SYMLINK_ERROR";
      constructor(t, e) {
        super("TAR_SYMLINK_ERROR: Cannot extract through symbolic link"), this.symlink = t, this.path = e;
      }
      get name() {
        return "SymlinkError";
      }
    };
    Qn = (s3, t) => {
      import_node_fs6.default.stat(s3, (e, i) => {
        (e || !i.isDirectory()) && (e = new we(s3, e?.code || "ENOTDIR")), t(e);
      });
    };
    Er = (s3, t, e) => {
      s3 = f(s3);
      let i = t.umask ?? 18, r = t.mode | 448, n = (r & i) !== 0, o = t.uid, h = t.gid, a = typeof o == "number" && typeof h == "number" && (o !== t.processUid || h !== t.processGid), l = t.preserve, c = t.unlink, d = f(t.cwd), S = (E, x) => {
        E ? e(E) : x && a ? ds(x, o, h, (xe) => S(xe)) : n ? import_node_fs6.default.chmod(s3, r, e) : e();
      };
      if (s3 === d) return Qn(s3, S);
      if (l) return import_promises2.default.mkdir(s3, { mode: r, recursive: true }).then((E) => S(null, E ?? void 0), S);
      let N = f(import_node_path10.default.relative(d, s3)).split("/");
      ms(d, N, r, c, d, void 0, S);
    };
    ms = (s3, t, e, i, r, n, o) => {
      if (t.length === 0) return o(null, n);
      let h = t.shift(), a = f(import_node_path10.default.resolve(s3 + "/" + h));
      import_node_fs6.default.mkdir(a, e, wr(a, t, e, i, r, n, o));
    };
    wr = (s3, t, e, i, r, n, o) => (h) => {
      h ? import_node_fs6.default.lstat(s3, (a, l) => {
        if (a) a.path = a.path && f(a.path), o(a);
        else if (l.isDirectory()) ms(s3, t, e, i, r, n, o);
        else if (i) import_node_fs6.default.unlink(s3, (c) => {
          if (c) return o(c);
          import_node_fs6.default.mkdir(s3, e, wr(s3, t, e, i, r, n, o));
        });
        else {
          if (l.isSymbolicLink()) return o(new wt(s3, s3 + "/" + t.join("/")));
          o(h);
        }
      }) : (n = n || s3, ms(s3, t, e, i, r, n, o));
    };
    Jn = (s3) => {
      let t = false, e;
      try {
        t = import_node_fs6.default.statSync(s3).isDirectory();
      } catch (i) {
        e = i?.code;
      } finally {
        if (!t) throw new we(s3, e ?? "ENOTDIR");
      }
    };
    Sr = (s3, t) => {
      s3 = f(s3);
      let e = t.umask ?? 18, i = t.mode | 448, r = (i & e) !== 0, n = t.uid, o = t.gid, h = typeof n == "number" && typeof o == "number" && (n !== t.processUid || o !== t.processGid), a = t.preserve, l = t.unlink, c = f(t.cwd), d = (E) => {
        E && h && us(E, n, o), r && import_node_fs6.default.chmodSync(s3, i);
      };
      if (s3 === c) return Jn(c), d();
      if (a) return d(import_node_fs6.default.mkdirSync(s3, { mode: i, recursive: true }) ?? void 0);
      let T = f(import_node_path10.default.relative(c, s3)).split("/"), N;
      for (let E = T.shift(), x = c; E && (x += "/" + E); E = T.shift()) {
        x = f(import_node_path10.default.resolve(x));
        try {
          import_node_fs6.default.mkdirSync(x, i), N = N || x;
        } catch {
          let xe = import_node_fs6.default.lstatSync(x);
          if (xe.isDirectory()) continue;
          if (l) {
            import_node_fs6.default.unlinkSync(x), import_node_fs6.default.mkdirSync(x, i), N = N || x;
            continue;
          } else if (xe.isSymbolicLink()) return new wt(x, x + "/" + T.join("/"));
        }
      }
      return d(N);
    };
    ps = /* @__PURE__ */ Object.create(null);
    yr = 1e4;
    $t = /* @__PURE__ */ new Set();
    Rr = (s3) => {
      $t.has(s3) ? $t.delete(s3) : ps[s3] = s3.normalize("NFD").toLocaleLowerCase("en").toLocaleUpperCase("en"), $t.add(s3);
      let t = ps[s3], e = $t.size - yr;
      if (e > yr / 10) {
        for (let i of $t) if ($t.delete(i), delete ps[i], --e <= 0) break;
      }
      return t;
    };
    to = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform;
    eo = to === "win32";
    io = (s3) => s3.split("/").slice(0, -1).reduce((e, i) => {
      let r = e.at(-1);
      return r !== void 0 && (i = (0, import_node_path11.join)(r, i)), e.push(i || "/"), e;
    }, []);
    Ei = class {
      #t = /* @__PURE__ */ new Map();
      #i = /* @__PURE__ */ new Map();
      #s = /* @__PURE__ */ new Set();
      reserve(t, e) {
        t = eo ? ["win32 parallelization disabled"] : t.map((r) => mt((0, import_node_path11.join)(Rr(r))));
        let i = new Set(t.map((r) => io(r)).reduce((r, n) => r.concat(n)));
        this.#i.set(e, { dirs: i, paths: t });
        for (let r of t) {
          let n = this.#t.get(r);
          n ? n.push(e) : this.#t.set(r, [e]);
        }
        for (let r of i) {
          let n = this.#t.get(r);
          if (!n) this.#t.set(r, [/* @__PURE__ */ new Set([e])]);
          else {
            let o = n.at(-1);
            o instanceof Set ? o.add(e) : n.push(/* @__PURE__ */ new Set([e]));
          }
        }
        return this.#r(e);
      }
      #n(t) {
        let e = this.#i.get(t);
        if (!e) throw new Error("function does not have any path reservations");
        return { paths: e.paths.map((i) => this.#t.get(i)), dirs: [...e.dirs].map((i) => this.#t.get(i)) };
      }
      check(t) {
        let { paths: e, dirs: i } = this.#n(t);
        return e.every((r) => r && r[0] === t) && i.every((r) => r && r[0] instanceof Set && r[0].has(t));
      }
      #r(t) {
        return this.#s.has(t) || !this.check(t) ? false : (this.#s.add(t), t(() => this.#e(t)), true);
      }
      #e(t) {
        if (!this.#s.has(t)) return false;
        let e = this.#i.get(t);
        if (!e) throw new Error("invalid reservation");
        let { paths: i, dirs: r } = e, n = /* @__PURE__ */ new Set();
        for (let o of i) {
          let h = this.#t.get(o);
          if (!h || h?.[0] !== t) continue;
          let a = h[1];
          if (!a) {
            this.#t.delete(o);
            continue;
          }
          if (h.shift(), typeof a == "function") n.add(a);
          else for (let l of a) n.add(l);
        }
        for (let o of r) {
          let h = this.#t.get(o), a = h?.[0];
          if (!(!h || !(a instanceof Set))) if (a.size === 1 && h.length === 1) {
            this.#t.delete(o);
            continue;
          } else if (a.size === 1) {
            h.shift();
            let l = h[0];
            typeof l == "function" && n.add(l);
          } else a.delete(t);
        }
        return this.#s.delete(t), n.forEach((o) => this.#r(o)), true;
      }
    };
    _r = () => process.umask();
    gr = Symbol("onEntry");
    ys = Symbol("checkFs");
    Or = Symbol("checkFs2");
    Rs = Symbol("isReusable");
    P = Symbol("makeFs");
    bs = Symbol("file");
    _s = Symbol("directory");
    Si = Symbol("link");
    Tr = Symbol("symlink");
    xr = Symbol("hardlink");
    ye = Symbol("ensureNoSymlink");
    Lr = Symbol("unsupported");
    Nr = Symbol("checkPath");
    Es = Symbol("stripAbsolutePath");
    St = Symbol("mkdir");
    O = Symbol("onError");
    wi = Symbol("pending");
    Ar = Symbol("pend");
    Xt = Symbol("unpend");
    ws = Symbol("ended");
    Ss = Symbol("maybeClose");
    gs = Symbol("skip");
    Re = Symbol("doChown");
    be = Symbol("uid");
    _e = Symbol("gid");
    ge = Symbol("checkedCwd");
    ro = process.env.TESTING_TAR_FAKE_PLATFORM || process.platform;
    Oe = ro === "win32";
    no = 1024;
    oo = (s3, t) => {
      if (!Oe) return import_node_fs4.default.unlink(s3, t);
      let e = s3 + ".DELETE." + (0, import_node_crypto2.randomBytes)(16).toString("hex");
      import_node_fs4.default.rename(s3, e, (i) => {
        if (i) return t(i);
        import_node_fs4.default.unlink(e, t);
      });
    };
    ho = (s3) => {
      if (!Oe) return import_node_fs4.default.unlinkSync(s3);
      let t = s3 + ".DELETE." + (0, import_node_crypto2.randomBytes)(16).toString("hex");
      import_node_fs4.default.renameSync(s3, t), import_node_fs4.default.unlinkSync(t);
    };
    Dr = (s3, t, e) => s3 !== void 0 && s3 === s3 >>> 0 ? s3 : t !== void 0 && t === t >>> 0 ? t : e;
    qt = class extends st {
      [ws] = false;
      [ge] = false;
      [wi] = 0;
      reservations = new Ei();
      transform;
      writable = true;
      readable = false;
      uid;
      gid;
      setOwner;
      preserveOwner;
      processGid;
      processUid;
      maxDepth;
      forceChown;
      win32;
      newer;
      keep;
      noMtime;
      preservePaths;
      unlink;
      cwd;
      strip;
      processUmask;
      umask;
      dmode;
      fmode;
      chmod;
      constructor(t = {}) {
        if (t.ondone = () => {
          this[ws] = true, this[Ss]();
        }, super(t), this.transform = t.transform, this.chmod = !!t.chmod, typeof t.uid == "number" || typeof t.gid == "number") {
          if (typeof t.uid != "number" || typeof t.gid != "number") throw new TypeError("cannot set owner without number uid and gid");
          if (t.preserveOwner) throw new TypeError("cannot preserve owner in archive and also set owner explicitly");
          this.uid = t.uid, this.gid = t.gid, this.setOwner = true;
        } else this.uid = void 0, this.gid = void 0, this.setOwner = false;
        this.preserveOwner = t.preserveOwner === void 0 && typeof t.uid != "number" ? !!(process.getuid && process.getuid() === 0) : !!t.preserveOwner, this.processUid = (this.preserveOwner || this.setOwner) && process.getuid ? process.getuid() : void 0, this.processGid = (this.preserveOwner || this.setOwner) && process.getgid ? process.getgid() : void 0, this.maxDepth = typeof t.maxDepth == "number" ? t.maxDepth : no, this.forceChown = t.forceChown === true, this.win32 = !!t.win32 || Oe, this.newer = !!t.newer, this.keep = !!t.keep, this.noMtime = !!t.noMtime, this.preservePaths = !!t.preservePaths, this.unlink = !!t.unlink, this.cwd = f(import_node_path8.default.resolve(t.cwd || process.cwd())), this.strip = Number(t.strip) || 0, this.processUmask = this.chmod ? typeof t.processUmask == "number" ? t.processUmask : _r() : 0, this.umask = typeof t.umask == "number" ? t.umask : this.processUmask, this.dmode = t.dmode || 511 & ~this.umask, this.fmode = t.fmode || 438 & ~this.umask, this.on("entry", (e) => this[gr](e));
      }
      warn(t, e, i = {}) {
        return (t === "TAR_BAD_ARCHIVE" || t === "TAR_ABORT") && (i.recoverable = false), super.warn(t, e, i);
      }
      [Ss]() {
        this[ws] && this[wi] === 0 && (this.emit("prefinish"), this.emit("finish"), this.emit("end"));
      }
      [Es](t, e) {
        let i = t[e], { type: r } = t;
        if (!i || this.preservePaths) return true;
        let [n, o] = ce(i), h = o.replaceAll(/\\/g, "/").split("/");
        if (h.includes("..") || Oe && /^[a-z]:\.\.$/i.test(h[0] ?? "")) {
          if (e === "path" || r === "Link") return this.warn("TAR_ENTRY_ERROR", `${e} contains '..'`, { entry: t, [e]: i }), false;
          let a = import_node_path8.default.posix.dirname(t.path), l = import_node_path8.default.posix.normalize(import_node_path8.default.posix.join(a, h.join("/")));
          if (l.startsWith("../") || l === "..") return this.warn("TAR_ENTRY_ERROR", `${e} escapes extraction directory`, { entry: t, [e]: i }), false;
        }
        return n && (t[e] = String(o), this.warn("TAR_ENTRY_INFO", `stripping ${n} from absolute ${e}`, { entry: t, [e]: i })), true;
      }
      [Nr](t) {
        let e = f(t.path), i = e.split("/");
        if (this.strip) {
          if (i.length < this.strip) return false;
          if (t.type === "Link") {
            let r = f(String(t.linkpath)).split("/");
            if (r.length >= this.strip) t.linkpath = r.slice(this.strip).join("/");
            else return false;
          }
          i.splice(0, this.strip), t.path = i.join("/");
        }
        if (isFinite(this.maxDepth) && i.length > this.maxDepth) return this.warn("TAR_ENTRY_ERROR", "path excessively deep", { entry: t, path: e, depth: i.length, maxDepth: this.maxDepth }), false;
        if (!this[Es](t, "path") || !this[Es](t, "linkpath")) return false;
        if (t.absolute = import_node_path8.default.isAbsolute(t.path) ? f(import_node_path8.default.resolve(t.path)) : f(import_node_path8.default.resolve(this.cwd, t.path)), !this.preservePaths && typeof t.absolute == "string" && t.absolute.indexOf(this.cwd + "/") !== 0 && t.absolute !== this.cwd) return this.warn("TAR_ENTRY_ERROR", "path escaped extraction target", { entry: t, path: f(t.path), resolvedPath: t.absolute, cwd: this.cwd }), false;
        if (t.absolute === this.cwd && t.type !== "Directory" && t.type !== "GNUDumpDir") return false;
        if (this.win32) {
          let { root: r } = import_node_path8.default.win32.parse(String(t.absolute));
          t.absolute = r + Xi(String(t.absolute).slice(r.length));
          let { root: n } = import_node_path8.default.win32.parse(t.path);
          t.path = n + Xi(t.path.slice(n.length));
        }
        return true;
      }
      [gr](t) {
        if (!this[Nr](t)) return t.resume();
        switch (import_node_assert.default.equal(typeof t.absolute, "string"), t.type) {
          case "Directory":
          case "GNUDumpDir":
            t.mode && (t.mode = t.mode | 448);
          case "File":
          case "OldFile":
          case "ContiguousFile":
          case "Link":
          case "SymbolicLink":
            return this[ys](t);
          default:
            return this[Lr](t);
        }
      }
      [O](t, e) {
        t.name === "CwdError" ? this.emit("error", t) : (this.warn("TAR_ENTRY_ERROR", t, { entry: e }), this[Xt](), e.resume());
      }
      [St](t, e, i) {
        Er(f(t), { uid: this.uid, gid: this.gid, processUid: this.processUid, processGid: this.processGid, umask: this.processUmask, preserve: this.preservePaths, unlink: this.unlink, cwd: this.cwd, mode: e }, i);
      }
      [Re](t) {
        return this.forceChown || this.preserveOwner && (typeof t.uid == "number" && t.uid !== this.processUid || typeof t.gid == "number" && t.gid !== this.processGid) || typeof this.uid == "number" && this.uid !== this.processUid || typeof this.gid == "number" && this.gid !== this.processGid;
      }
      [be](t) {
        return Dr(this.uid, t.uid, this.processUid);
      }
      [_e](t) {
        return Dr(this.gid, t.gid, this.processGid);
      }
      [bs](t, e) {
        let i = typeof t.mode == "number" ? t.mode & 4095 : this.fmode, r = new tt(String(t.absolute), { flags: cs(t.size), mode: i, autoClose: false });
        r.on("error", (a) => {
          r.fd && import_node_fs4.default.close(r.fd, () => {
          }), r.write = () => true, this[O](a, t), e();
        });
        let n = 1, o = (a) => {
          if (a) {
            r.fd && import_node_fs4.default.close(r.fd, () => {
            }), this[O](a, t), e();
            return;
          }
          --n === 0 && r.fd !== void 0 && import_node_fs4.default.close(r.fd, (l) => {
            l ? this[O](l, t) : this[Xt](), e();
          });
        };
        r.on("finish", () => {
          let a = String(t.absolute), l = r.fd;
          if (typeof l == "number" && t.mtime && !this.noMtime) {
            n++;
            let c = t.atime || /* @__PURE__ */ new Date(), d = t.mtime;
            import_node_fs4.default.futimes(l, c, d, (S) => S ? import_node_fs4.default.utimes(a, c, d, (T) => o(T && S)) : o());
          }
          if (typeof l == "number" && this[Re](t)) {
            n++;
            let c = this[be](t), d = this[_e](t);
            typeof c == "number" && typeof d == "number" && import_node_fs4.default.fchown(l, c, d, (S) => S ? import_node_fs4.default.chown(a, c, d, (T) => o(T && S)) : o());
          }
          o();
        });
        let h = this.transform && this.transform(t) || t;
        h !== t && (h.on("error", (a) => {
          this[O](a, t), e();
        }), t.pipe(h)), h.pipe(r);
      }
      [_s](t, e) {
        let i = typeof t.mode == "number" ? t.mode & 4095 : this.dmode;
        this[St](String(t.absolute), i, (r) => {
          if (r) {
            this[O](r, t), e();
            return;
          }
          let n = 1, o = () => {
            --n === 0 && (e(), this[Xt](), t.resume());
          };
          t.mtime && !this.noMtime && (n++, import_node_fs4.default.utimes(String(t.absolute), t.atime || /* @__PURE__ */ new Date(), t.mtime, o)), this[Re](t) && (n++, import_node_fs4.default.chown(String(t.absolute), Number(this[be](t)), Number(this[_e](t)), o)), o();
        });
      }
      [Lr](t) {
        t.unsupported = true, this.warn("TAR_ENTRY_UNSUPPORTED", `unsupported entry type: ${t.type}`, { entry: t }), t.resume();
      }
      [Tr](t, e) {
        let i = f(import_node_path8.default.relative(this.cwd, import_node_path8.default.resolve(import_node_path8.default.dirname(String(t.absolute)), String(t.linkpath)))).split("/");
        this[ye](t, this.cwd, i, () => this[Si](t, String(t.linkpath), "symlink", e), (r) => {
          this[O](r, t), e();
        });
      }
      [xr](t, e) {
        let i = f(import_node_path8.default.resolve(this.cwd, String(t.linkpath))), r = f(String(t.linkpath)).split("/");
        this[ye](t, this.cwd, r, () => this[Si](t, i, "link", e), (n) => {
          this[O](n, t), e();
        });
      }
      [ye](t, e, i, r, n) {
        let o = i.shift();
        if (this.preservePaths || o === void 0) return r();
        let h = import_node_path8.default.resolve(e, o);
        import_node_fs4.default.lstat(h, (a, l) => {
          if (a) return r();
          if (l?.isSymbolicLink()) return n(new wt(h, import_node_path8.default.resolve(h, i.join("/"))));
          this[ye](t, h, i, r, n);
        });
      }
      [Ar]() {
        this[wi]++;
      }
      [Xt]() {
        this[wi]--, this[Ss]();
      }
      [gs](t) {
        this[Xt](), t.resume();
      }
      [Rs](t, e) {
        return t.type === "File" && !this.unlink && e.isFile() && e.nlink <= 1 && !Oe;
      }
      [ys](t) {
        this[Ar]();
        let e = [t.path];
        t.linkpath && e.push(t.linkpath), this.reservations.reserve(e, (i) => this[Or](t, i));
      }
      [Or](t, e) {
        let i = (h) => {
          e(h);
        }, r = () => {
          this[St](this.cwd, this.dmode, (h) => {
            if (h) {
              this[O](h, t), i();
              return;
            }
            this[ge] = true, n();
          });
        }, n = () => {
          if (t.absolute !== this.cwd) {
            let h = f(import_node_path8.default.dirname(String(t.absolute)));
            if (h !== this.cwd) return this[St](h, this.dmode, (a) => {
              if (a) {
                this[O](a, t), i();
                return;
              }
              o();
            });
          }
          o();
        }, o = () => {
          import_node_fs4.default.lstat(String(t.absolute), (h, a) => {
            if (a && (this.keep || this.newer && a.mtime > (t.mtime ?? a.mtime))) {
              this[gs](t), i();
              return;
            }
            if (h || this[Rs](t, a)) return this[P](null, t, i);
            if (a.isDirectory()) {
              if (t.type === "Directory") {
                let l = this.chmod && t.mode && (a.mode & 4095) !== t.mode, c = (d) => this[P](d ?? null, t, i);
                return l ? import_node_fs4.default.chmod(String(t.absolute), Number(t.mode), c) : c();
              }
              if (t.absolute !== this.cwd) return import_node_fs4.default.rmdir(String(t.absolute), (l) => this[P](l ?? null, t, i));
            }
            if (t.absolute === this.cwd) return this[P](null, t, i);
            oo(String(t.absolute), (l) => this[P](l ?? null, t, i));
          });
        };
        this[ge] ? n() : r();
      }
      [P](t, e, i) {
        if (t) {
          this[O](t, e), i();
          return;
        }
        switch (e.type) {
          case "File":
          case "OldFile":
          case "ContiguousFile":
            return this[bs](e, i);
          case "Link":
            return this[xr](e, i);
          case "SymbolicLink":
            return this[Tr](e, i);
          case "Directory":
          case "GNUDumpDir":
            return this[_s](e, i);
        }
      }
      [Si](t, e, i, r) {
        import_node_fs4.default[i](e, String(t.absolute), (n) => {
          n ? this[O](n, t) : (this[Xt](), t.resume()), r();
        });
      }
    };
    Se = (s3) => {
      try {
        return [null, s3()];
      } catch (t) {
        return [t, null];
      }
    };
    Te = class extends qt {
      sync = true;
      [P](t, e) {
        return super[P](t, e, () => {
        });
      }
      [ys](t) {
        if (!this[ge]) {
          let n = this[St](this.cwd, this.dmode);
          if (n) return this[O](n, t);
          this[ge] = true;
        }
        if (t.absolute !== this.cwd) {
          let n = f(import_node_path8.default.dirname(String(t.absolute)));
          if (n !== this.cwd) {
            let o = this[St](n, this.dmode);
            if (o) return this[O](o, t);
          }
        }
        let [e, i] = Se(() => import_node_fs4.default.lstatSync(String(t.absolute)));
        if (i && (this.keep || this.newer && i.mtime > (t.mtime ?? i.mtime))) return this[gs](t);
        if (e || this[Rs](t, i)) return this[P](null, t);
        if (i.isDirectory()) {
          if (t.type === "Directory") {
            let o = this.chmod && t.mode && (i.mode & 4095) !== t.mode, [h] = o ? Se(() => {
              import_node_fs4.default.chmodSync(String(t.absolute), Number(t.mode));
            }) : [];
            return this[P](h, t);
          }
          let [n] = Se(() => import_node_fs4.default.rmdirSync(String(t.absolute)));
          this[P](n, t);
        }
        let [r] = t.absolute === this.cwd ? [] : Se(() => ho(String(t.absolute)));
        this[P](r, t);
      }
      [bs](t, e) {
        let i = typeof t.mode == "number" ? t.mode & 4095 : this.fmode, r = (h) => {
          let a;
          try {
            import_node_fs4.default.closeSync(n);
          } catch (l) {
            a = l;
          }
          (h || a) && this[O](h || a, t), e();
        }, n;
        try {
          n = import_node_fs4.default.openSync(String(t.absolute), cs(t.size), i);
        } catch (h) {
          return r(h);
        }
        let o = this.transform && this.transform(t) || t;
        o !== t && (o.on("error", (h) => this[O](h, t)), t.pipe(o)), o.on("data", (h) => {
          try {
            import_node_fs4.default.writeSync(n, h, 0, h.length);
          } catch (a) {
            r(a);
          }
        }), o.on("end", () => {
          let h = null;
          if (t.mtime && !this.noMtime) {
            let a = t.atime || /* @__PURE__ */ new Date(), l = t.mtime;
            try {
              import_node_fs4.default.futimesSync(n, a, l);
            } catch (c) {
              try {
                import_node_fs4.default.utimesSync(String(t.absolute), a, l);
              } catch {
                h = c;
              }
            }
          }
          if (this[Re](t)) {
            let a = this[be](t), l = this[_e](t);
            try {
              import_node_fs4.default.fchownSync(n, Number(a), Number(l));
            } catch (c) {
              try {
                import_node_fs4.default.chownSync(String(t.absolute), Number(a), Number(l));
              } catch {
                h = h || c;
              }
            }
          }
          r(h);
        });
      }
      [_s](t, e) {
        let i = typeof t.mode == "number" ? t.mode & 4095 : this.dmode, r = this[St](String(t.absolute), i);
        if (r) {
          this[O](r, t), e();
          return;
        }
        if (t.mtime && !this.noMtime) try {
          import_node_fs4.default.utimesSync(String(t.absolute), t.atime || /* @__PURE__ */ new Date(), t.mtime);
        } catch {
        }
        if (this[Re](t)) try {
          import_node_fs4.default.chownSync(String(t.absolute), Number(this[be](t)), Number(this[_e](t)));
        } catch {
        }
        e(), t.resume();
      }
      [St](t, e) {
        try {
          return Sr(f(t), { uid: this.uid, gid: this.gid, processUid: this.processUid, processGid: this.processGid, umask: this.processUmask, preserve: this.preservePaths, unlink: this.unlink, cwd: this.cwd, mode: e });
        } catch (i) {
          return i;
        }
      }
      [ye](t, e, i, r, n) {
        if (this.preservePaths || i.length === 0) return r();
        let o = e;
        for (let h of i) {
          o = import_node_path8.default.resolve(o, h);
          let [a, l] = Se(() => import_node_fs4.default.lstatSync(o));
          if (a) return r();
          if (l.isSymbolicLink()) return n(new wt(o, import_node_path8.default.resolve(e, i.join("/"))));
        }
        r();
      }
      [Si](t, e, i, r) {
        let n = `${i}Sync`;
        try {
          import_node_fs4.default[n](e, String(t.absolute)), r(), t.resume();
        } catch (o) {
          return this[O](o, t);
        }
      }
    };
    ao = (s3) => {
      let t = new Te(s3), e = s3.file, i = import_node_fs3.default.statSync(e), r = s3.maxReadSize || 16 * 1024 * 1024;
      new Me(e, { readSize: r, size: i.size }).pipe(t);
    };
    lo = (s3, t) => {
      let e = new qt(s3), i = s3.maxReadSize || 16 * 1024 * 1024, r = s3.file;
      return new Promise((o, h) => {
        e.on("error", h), e.on("close", o), import_node_fs3.default.stat(r, (a, l) => {
          if (a) h(a);
          else {
            let c = new _t(r, { readSize: i, size: l.size });
            c.on("error", h), c.pipe(e);
          }
        });
      });
    };
    co = K(ao, lo, (s3) => new Te(s3), (s3) => new qt(s3), (s3, t) => {
      t?.length && Ki(s3, t);
    });
    fo = (s3, t) => {
      let e = new kt(s3), i = true, r, n;
      try {
        try {
          r = import_node_fs7.default.openSync(s3.file, "r+");
        } catch (a) {
          if (a?.code === "ENOENT") r = import_node_fs7.default.openSync(s3.file, "w+");
          else throw a;
        }
        let o = import_node_fs7.default.fstatSync(r), h = Buffer.alloc(512);
        t: for (n = 0; n < o.size; n += 512) {
          for (let c = 0, d = 0; c < 512; c += d) {
            if (d = import_node_fs7.default.readSync(r, h, c, h.length - c, n + c), n === 0 && h[0] === 31 && h[1] === 139) throw new Error("cannot append to compressed archives");
            if (!d) break t;
          }
          let a = new F(h);
          if (!a.cksumValid) break;
          let l = 512 * Math.ceil((a.size || 0) / 512);
          if (n + l + 512 > o.size) break;
          n += l, s3.mtimeCache && a.mtime && s3.mtimeCache.set(String(a.path), a.mtime);
        }
        i = false, uo(s3, e, n, r, t);
      } finally {
        if (i) try {
          import_node_fs7.default.closeSync(r);
        } catch {
        }
      }
    };
    uo = (s3, t, e, i, r) => {
      let n = new Wt(s3.file, { fd: i, start: e });
      t.pipe(n), po(t, r);
    };
    mo = (s3, t) => {
      t = Array.from(t);
      let e = new Et(s3), i = (n, o, h) => {
        let a = (T, N) => {
          T ? import_node_fs7.default.close(n, (E) => h(T)) : h(null, N);
        }, l = 0;
        if (o === 0) return a(null, 0);
        let c = 0, d = Buffer.alloc(512), S = (T, N) => {
          if (T || N === void 0) return a(T);
          if (c += N, c < 512 && N) return import_node_fs7.default.read(n, d, c, d.length - c, l + c, S);
          if (l === 0 && d[0] === 31 && d[1] === 139) return a(new Error("cannot append to compressed archives"));
          if (c < 512) return a(null, l);
          let E = new F(d);
          if (!E.cksumValid) return a(null, l);
          let x = 512 * Math.ceil((E.size ?? 0) / 512);
          if (l + x + 512 > o || (l += x + 512, l >= o)) return a(null, l);
          s3.mtimeCache && E.mtime && s3.mtimeCache.set(String(E.path), E.mtime), c = 0, import_node_fs7.default.read(n, d, 0, 512, l, S);
        };
        import_node_fs7.default.read(n, d, 0, 512, l, S);
      };
      return new Promise((n, o) => {
        e.on("error", o);
        let h = "r+", a = (l, c) => {
          if (l && l.code === "ENOENT" && h === "r+") return h = "w+", import_node_fs7.default.open(s3.file, h, a);
          if (l || !c) return o(l);
          import_node_fs7.default.fstat(c, (d, S) => {
            if (d) return import_node_fs7.default.close(c, () => o(d));
            i(c, S.size, (T, N) => {
              if (T) return o(T);
              let E = new tt(s3.file, { fd: c, start: N });
              e.pipe(E), E.on("error", o), E.on("close", n), Eo(e, t);
            });
          });
        };
        import_node_fs7.default.open(s3.file, h, a);
      });
    };
    po = (s3, t) => {
      t.forEach((e) => {
        e.charAt(0) === "@" ? It({ file: import_node_path12.default.resolve(s3.cwd, e.slice(1)), sync: true, noResume: true, onReadEntry: (i) => s3.add(i) }) : s3.add(e);
      }), s3.end();
    };
    Eo = async (s3, t) => {
      for (let e of t) e.charAt(0) === "@" ? await It({ file: import_node_path12.default.resolve(String(s3.cwd), e.slice(1)), noResume: true, onReadEntry: (i) => s3.add(i) }) : s3.add(e);
      s3.end();
    };
    vt = K(fo, mo, () => {
      throw new TypeError("file is required");
    }, () => {
      throw new TypeError("file is required");
    }, (s3, t) => {
      if (!Fs(s3)) throw new TypeError("file is required");
      if (s3.gzip || s3.brotli || s3.zstd || s3.file.endsWith(".br") || s3.file.endsWith(".tbr")) throw new TypeError("cannot append to compressed archives");
      if (!t?.length) throw new TypeError("no paths specified to add/replace");
    });
    wo = K(vt.syncFile, vt.asyncFile, vt.syncNoFile, vt.asyncNoFile, (s3, t = []) => {
      vt.validate?.(s3, t), So(s3);
    });
    So = (s3) => {
      let t = s3.filter;
      s3.mtimeCache || (s3.mtimeCache = /* @__PURE__ */ new Map()), s3.filter = t ? (e, i) => t(e, i) && !((s3.mtimeCache?.get(e) ?? i.mtime ?? 0) > (i.mtime ?? 0)) : (e, i) => !((s3.mtimeCache?.get(e) ?? i.mtime ?? 0) > (i.mtime ?? 0));
    };
  }
});

// ../core/src/model-download-worker.ts
var import_promises7 = require("node:fs/promises");

// ../core/src/config.ts
var import_node_path = require("node:path");

// ../core/src/file-utils.ts
var fs = __toESM(require("node:fs"), 1);
var fsPromises = __toESM(require("node:fs/promises"), 1);
var import_node_os = require("node:os");
var name1 = "read";
var name2 = "File";
function getFileContent(path, encoding = "utf-8") {
  return fsPromises[name1 + name2](path, encoding);
}
function getFileContentSync(path, encoding = "utf-8") {
  return fs[`${name1 + name2}Sync`](path, encoding);
}
function getProcEnv() {
  return process["env"];
}
function getHomeDir() {
  return getProcEnv().HOME || (0, import_node_os.homedir)();
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_2) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k2) => typeof obj[obj[k2]] !== "number");
    const filtered = {};
    for (const k2 of validKeys) {
      filtered[k2] = obj[k2];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_2, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m2) => !!m2).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s3 of results) {
      if (s3.status === "aborted")
        return INVALID;
      if (s3.status === "dirty")
        status.dirty();
      arrayValue.push(s3.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b2) {
  const aType = getParsedType(a);
  const bType = getParsedType(b2);
  if (a === b2) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b2);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b2 };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b2[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b2.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b2[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b2) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn2 = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me2 = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me2._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn2, this, parsedArgs);
        const parsedReturns = await me2._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me2 = this;
      return OK(function(...args) {
        const parsedArgs = me2._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn2, this, parsedArgs.data);
        const parsedReturns = me2._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b2) {
    return new _ZodPipeline({
      in: a,
      out: b2,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p2 = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p22 = typeof p2 === "string" ? { message: p2 } : p2;
  return p22;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// ../core/src/types.ts
var nullLogger = {
  debug() {
  },
  info() {
  },
  warn() {
  },
  error() {
  }
};
var ArtifactTypeSchema = external_exports.enum(["url", "command", "file_path", "content"]);
var ArtifactSchema = external_exports.object({
  type: ArtifactTypeSchema,
  value: external_exports.string(),
  context: external_exports.string().optional()
});
var VerdictSeveritySchema = external_exports.enum(["info", "warning", "critical"]);
var ThreatSchema = external_exports.object({
  id: external_exports.string(),
  version: external_exports.number().int().optional(),
  category: external_exports.string(),
  severity: VerdictSeveritySchema,
  confidence: external_exports.number(),
  pattern: external_exports.string(),
  match_on: external_exports.union([external_exports.string(), external_exports.array(external_exports.string())]),
  title: external_exports.string(),
  expires_at: external_exports.string().nullable().optional(),
  revoked: external_exports.boolean().optional().default(false),
  flags: external_exports.array(external_exports.string()).optional().default([])
});
var DecisionSchema = external_exports.enum(["allow", "deny", "ask"]);
var SensitivitySchema = external_exports.enum(["paranoid", "balanced", "relaxed"]);
var UrlCheckConfigSchema = external_exports.object({
  endpoint: external_exports.string().optional(),
  timeout_seconds: external_exports.number().default(5),
  enabled: external_exports.boolean().default(true)
});
var CacheConfigSchema = external_exports.object({
  enabled: external_exports.boolean().default(true),
  ttl_malicious_seconds: external_exports.number().default(3600),
  ttl_clean_seconds: external_exports.number().default(86400),
  path: external_exports.string().default("~/.sage/cache.json")
});
var LoggingConfigSchema = external_exports.object({
  enabled: external_exports.boolean().default(true),
  log_clean: external_exports.boolean().default(false),
  path: external_exports.string().default("~/.sage/audit.jsonl"),
  max_bytes: external_exports.number().int().min(0).default(5 * 1024 * 1024),
  max_files: external_exports.number().int().min(0).default(3)
});
var OperationalLogLevelSchema = external_exports.enum(["debug", "info", "warn", "error"]);
var OperationalLoggingConfigSchema = external_exports.object({
  enabled: external_exports.boolean().default(true),
  level: OperationalLogLevelSchema.default("info"),
  path: external_exports.string().default("~/.sage/operational.jsonl"),
  max_bytes: external_exports.number().int().min(0).default(5 * 1024 * 1024),
  max_files: external_exports.number().int().min(0).default(3)
});
var FileCheckConfigSchema = external_exports.object({
  endpoint: external_exports.string().optional(),
  timeout_seconds: external_exports.number().default(5),
  enabled: external_exports.boolean().default(true)
});
var PackageCheckConfigSchema = external_exports.object({
  enabled: external_exports.boolean().default(true),
  timeout_seconds: external_exports.number().default(5)
  // v1: all scoped packages (@scope/pkg) are skipped automatically.
  // Future: add private_scopes / public_scopes config for fine-grained control.
});
var AmsiCheckConfigSchema = external_exports.object({
  enabled: external_exports.boolean().default(true)
});
var DEFAULT_PI_HIGH_RISK_THRESHOLD = 0.99;
var DEFAULT_PI_MEDIUM_RISK_THRESHOLD = 0.5;
var PiCheckConfigSchema = external_exports.object({
  enabled: external_exports.boolean().default(false),
  max_content_length: external_exports.number().default(16384),
  model_path: external_exports.string().optional(),
  high_risk_threshold: external_exports.number().default(DEFAULT_PI_HIGH_RISK_THRESHOLD),
  medium_risk_threshold: external_exports.number().default(DEFAULT_PI_MEDIUM_RISK_THRESHOLD)
});
var ExceptionDecisionSchema = external_exports.enum(["allow", "deny"]);
var ExceptionMatchSchema = external_exports.enum(["executable", "domain", "path", "plugin", "regex"]);
var ExceptionRuleSchema = external_exports.object({
  id: external_exports.string().optional(),
  decision: ExceptionDecisionSchema,
  match: ExceptionMatchSchema,
  pattern: external_exports.string(),
  reason: external_exports.string().optional()
});
var ExceptionsFileSchema = external_exports.object({
  rules: external_exports.array(ExceptionRuleSchema).default([])
});
var ExceptionsConfigSchema = external_exports.object({
  path: external_exports.string().default("~/.sage/exceptions.json")
});
var ConfigSchema = external_exports.object({
  url_check: UrlCheckConfigSchema.default({}),
  file_check: FileCheckConfigSchema.default({}),
  package_check: PackageCheckConfigSchema.default({}),
  amsi_check: AmsiCheckConfigSchema.default({}),
  pi_check: PiCheckConfigSchema.default({}),
  heuristics_enabled: external_exports.boolean().default(true),
  cache: CacheConfigSchema.default({}),
  exceptions: ExceptionsConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  operational_logging: OperationalLoggingConfigSchema.default({}),
  sensitivity: SensitivitySchema.default("balanced"),
  disabled_threats: external_exports.array(external_exports.string()).default([]),
  brand_key: external_exports.string().min(1).max(32).regex(/^[a-z0-9_-]+$/u).optional(),
  community_iq: external_exports.boolean().default(true)
});
var HookTypeSchema = external_exports.enum([
  "PreToolUse",
  "PostToolUse",
  "SessionStart",
  "GatewayStart",
  "BeforeAgentStart",
  "MessagesTransform"
]);

// ../core/src/config.ts
var SAGE_DIR = "~/.sage";
function resolvedSageDir() {
  return resolvePath(SAGE_DIR);
}
function defaultConfigPath() {
  return (0, import_node_path.join)(resolvedSageDir(), "config.json");
}
function defaultCachePath() {
  return (0, import_node_path.join)(resolvedSageDir(), "cache.json");
}
function defaultExceptionsPath() {
  return (0, import_node_path.join)(resolvedSageDir(), "exceptions.json");
}
function defaultAuditPath() {
  return (0, import_node_path.join)(resolvedSageDir(), "audit.jsonl");
}
function defaultOperationalLogPath() {
  return (0, import_node_path.join)(resolvedSageDir(), "operational.jsonl");
}
function resolvePath(pathStr) {
  if (pathStr.startsWith("~/") || pathStr === "~") {
    const home = getHomeDir();
    return (0, import_node_path.join)(home, pathStr.slice(1));
  }
  return pathStr;
}
function isWithinDirectory(baseDir, targetPath) {
  const rel = (0, import_node_path.relative)(baseDir, targetPath);
  if (rel === "") return true;
  if ((0, import_node_path.isAbsolute)(rel)) return false;
  return rel !== ".." && !rel.startsWith(`..${import_node_path.sep}`);
}
function normalizeStateFilePath(configuredPath, fallbackPath, field, logger) {
  const sageDir = resolvedSageDir();
  const trimmed = configuredPath.trim();
  if (trimmed === "") {
    logger.warn(`Config ${field}.path is empty; using default`, {
      configuredPath,
      defaultPath: fallbackPath
    });
    return fallbackPath;
  }
  const expanded = resolvePath(trimmed);
  const resolved = (0, import_node_path.isAbsolute)(expanded) ? (0, import_node_path.resolve)(expanded) : (0, import_node_path.resolve)(sageDir, expanded);
  if (isWithinDirectory(sageDir, resolved)) {
    if (resolved === sageDir) {
      logger.warn(`Config ${field}.path must point to a file; using default`, {
        configuredPath,
        defaultPath: fallbackPath
      });
      return fallbackPath;
    }
    return resolved;
  }
  logger.warn(`Config ${field}.path escapes ${sageDir}; using default`, {
    configuredPath,
    defaultPath: fallbackPath
  });
  return fallbackPath;
}
var BRAND_KEY_RE = /^[a-z0-9_-]+$/u;
function sanitizeBrandKey(data, logger) {
  const brandKey = data.brand_key;
  if (brandKey === void 0) return data;
  if (typeof brandKey === "string" && brandKey.length >= 1 && brandKey.length <= 32 && BRAND_KEY_RE.test(brandKey)) {
    return data;
  }
  logger.warn(`Invalid brand_key in config \u2014 ignoring`, { brand_key: brandKey });
  const { brand_key: _2, ...rest } = data;
  return rest;
}
function sanitizeConfigPaths(config, logger) {
  const cachePath = defaultCachePath();
  const exceptionsPath = defaultExceptionsPath();
  const auditPath = defaultAuditPath();
  const operationalLogPath = defaultOperationalLogPath();
  return {
    ...config,
    cache: {
      ...config.cache,
      path: normalizeStateFilePath(config.cache.path, cachePath, "cache", logger)
    },
    exceptions: {
      ...config.exceptions,
      path: normalizeStateFilePath(config.exceptions.path, exceptionsPath, "exceptions", logger)
    },
    logging: {
      ...config.logging,
      path: normalizeStateFilePath(config.logging.path, auditPath, "logging", logger)
    },
    operational_logging: {
      ...config.operational_logging,
      path: normalizeStateFilePath(
        config.operational_logging.path,
        operationalLogPath,
        "operational_logging",
        logger
      )
    }
  };
}
function defaultConfig(logger) {
  return sanitizeConfigPaths(ConfigSchema.parse({}), logger);
}
function parseConfig(raw, path, logger) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    logger.warn(`Failed to parse config from ${path}`, { error: String(e) });
    return defaultConfig(logger);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    logger.warn(`Config file ${path} does not contain a JSON object`);
    return defaultConfig(logger);
  }
  const sanitized = sanitizeBrandKey(data, logger);
  try {
    return sanitizeConfigPaths(ConfigSchema.parse(sanitized), logger);
  } catch (e) {
    logger.warn(`Config validation failed, using defaults`, { error: String(e) });
    return defaultConfig(logger);
  }
}
async function loadConfig(configPath, logger = nullLogger) {
  const path = configPath ? resolvePath(configPath) : defaultConfigPath();
  try {
    return parseConfig(await getFileContent(path), path, logger);
  } catch {
    return defaultConfig(logger);
  }
}

// ../core/src/installation-id.ts
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path2 = require("node:path");
async function getInstallationId(sageDirPath) {
  const sageDir = sageDirPath ?? resolvePath("~/.sage");
  const idPath = (0, import_node_path2.join)(sageDir, "installation-id");
  let fileExists = false;
  try {
    const existing = await getFileContent(idPath, "utf-8");
    const trimmed = existing.trim();
    if (trimmed.length > 0) return trimmed;
    fileExists = true;
  } catch {
  }
  try {
    const id = (0, import_node_crypto.randomUUID)();
    await (0, import_promises.mkdir)(sageDir, { recursive: true, mode: 448 });
    await (0, import_promises.writeFile)(idPath, id, { encoding: "utf-8", mode: 384, flag: fileExists ? "w" : "wx" });
    return id;
  } catch (err) {
    if (err.code === "EEXIST") {
      try {
        const existing = await getFileContent(idPath, "utf-8");
        return existing.trim() || void 0;
      } catch {
        return void 0;
      }
    }
    return void 0;
  }
}

// ../core/src/clients/model-downloader.ts
var import_node_crypto3 = require("node:crypto");
var import_node_fs8 = require("node:fs");
var import_promises3 = require("node:fs/promises");
var import_node_path13 = require("node:path");
var import_node_stream2 = require("node:stream");
var import_promises4 = require("node:stream/promises");

// ../core/src/model-storage.ts
var import_node_fs = require("node:fs");
var import_node_path3 = require("node:path");
var MODEL_SCHEMA_VERSION = "v1";
var REQUIRED_MODELS_BY_SCHEMA = {
  v1: ["pi-model"]
};
var REQUIRED_MODEL_FILES = {
  "pi-model": [
    "model_int8.onnx",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "vocab.txt",
    "config.json"
  ]
};
function getModelStorageRoot(sageDir = resolvePath("~/.sage")) {
  return (0, import_node_path3.join)(resolvePath(sageDir), "models");
}
function getModelDir(modelName, schema = MODEL_SCHEMA_VERSION, sageDir) {
  return (0, import_node_path3.join)(getModelStorageRoot(sageDir), schema, modelName);
}
function getDownloadStagingDir(sageDir) {
  return (0, import_node_path3.join)(getModelStorageRoot(sageDir), ".download");
}
function isModelPresent(modelName, schema = MODEL_SCHEMA_VERSION, sageDir) {
  const dir = getModelDir(modelName, schema, sageDir);
  const files = REQUIRED_MODEL_FILES[modelName];
  if (!files || files.length === 0) return false;
  return files.every((f2) => (0, import_node_fs.existsSync)((0, import_node_path3.resolve)(dir, f2)));
}
function requiredModelFiles(modelName) {
  return REQUIRED_MODEL_FILES[modelName] ?? [];
}
function missingRequiredModels(schema = MODEL_SCHEMA_VERSION, sageDir) {
  const required = REQUIRED_MODELS_BY_SCHEMA[schema] ?? [];
  return required.filter((name) => !isModelPresent(name, schema, sageDir));
}

// ../core/src/clients/model-downloader.ts
var STALE_LOCK_MS = 60 * 60 * 1e3;
async function downloadModel(opts) {
  const logger = opts.logger ?? nullLogger;
  const { modelName, entry, schema, sageDir } = opts;
  if (isModelPresent(modelName, schema, sageDir)) return true;
  if (!entry.sha256) {
    logger.warn(`missing sha256 for model ${modelName}; aborting`);
    return false;
  }
  const modelDir = getModelDir(modelName, schema, sageDir);
  const stagingDir = getDownloadStagingDir(sageDir);
  const lockPath = `${modelDir}.lock`;
  try {
    await (0, import_promises3.mkdir)(stagingDir, { recursive: true });
    await (0, import_promises3.mkdir)((0, import_node_path13.resolve)(modelDir, ".."), { recursive: true });
  } catch (err) {
    logger.warn(`failed to prepare model storage for ${modelName}: ${err}`);
    return false;
  }
  const acquired = await tryAcquireLock(lockPath, logger);
  if (!acquired) {
    logger.debug(`another process is downloading ${modelName}; skipping`);
    return isModelPresent(modelName, schema, sageDir);
  }
  let archivePath = null;
  let extractDir = null;
  try {
    if (isModelPresent(modelName, schema, sageDir)) return true;
    const suffix = (0, import_node_crypto3.randomBytes)(6).toString("hex");
    archivePath = (0, import_node_path13.join)(stagingDir, `${modelName}.${suffix}.tar.gz`);
    extractDir = (0, import_node_path13.join)(stagingDir, `${modelName}.${suffix}.partial`);
    await streamFetchToFile(entry.url, archivePath, opts.fetchImpl);
    const actualSha = await sha256OfFile(archivePath);
    if (actualSha !== entry.sha256.toLowerCase()) {
      logger.warn(`checksum mismatch for model ${modelName}`, {
        expected: entry.sha256,
        actual: actualSha
      });
      return false;
    }
    await (0, import_promises3.mkdir)(extractDir, { recursive: true });
    await extractTarGz(archivePath, extractDir);
    const extractDirResolved = extractDir;
    const missing = requiredModelFiles(modelName).filter(
      (f2) => !fileExistsSync((0, import_node_path13.resolve)(extractDirResolved, f2))
    );
    if (missing.length > 0) {
      logger.warn(`failed to install model ${modelName}: archive missing ${missing.join(", ")}`);
      return false;
    }
    const aside = `${modelDir}.${suffix}.old`;
    let asideUsed = false;
    if (await pathExists(modelDir)) {
      await (0, import_promises3.rename)(modelDir, aside);
      asideUsed = true;
    }
    try {
      await (0, import_promises3.rename)(extractDir, modelDir);
      extractDir = null;
    } catch (err) {
      if (asideUsed) {
        try {
          await (0, import_promises3.rename)(aside, modelDir);
        } catch {
        }
      }
      throw err;
    }
    if (asideUsed) {
      await (0, import_promises3.rm)(aside, { recursive: true, force: true }).catch(() => {
      });
    }
    await (0, import_promises3.unlink)(archivePath).catch(() => {
    });
    archivePath = null;
    logger.info(`model ${modelName} installed (schema ${schema})`);
    return true;
  } catch (err) {
    logger.warn(
      `failed to download model ${modelName}: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  } finally {
    if (extractDir) {
      await (0, import_promises3.rm)(extractDir, { recursive: true, force: true }).catch(() => {
      });
    }
    if (archivePath) {
      await (0, import_promises3.unlink)(archivePath).catch(() => {
      });
    }
    await (0, import_promises3.unlink)(lockPath).catch(() => {
    });
  }
}
async function streamFetchToFile(url, destPath, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  if (!response.body) {
    throw new Error(`empty response body from ${url}`);
  }
  const nodeStream = import_node_stream2.Readable.fromWeb(response.body);
  await (0, import_promises4.pipeline)(nodeStream, (0, import_node_fs8.createWriteStream)(destPath));
}
async function sha256OfFile(path) {
  const hash = (0, import_node_crypto3.createHash)("sha256");
  const buf = await (0, import_promises3.readFile)(path);
  hash.update(buf);
  return hash.digest("hex");
}
async function extractTarGz(archivePath, destDir) {
  const tarMod = await Promise.resolve().then(() => (init_index_min(), index_min_exports));
  const extract = tarMod.extract ?? tarMod.x;
  if (typeof extract !== "function") {
    throw new Error("`tar` package missing extract function");
  }
  await extract({ file: archivePath, cwd: destDir, strip: 1 });
}
async function pathExists(path) {
  try {
    await (0, import_promises3.stat)(path);
    return true;
  } catch {
    return false;
  }
}
function fileExistsSync(path) {
  try {
    (0, import_node_fs8.statSync)(path);
    return true;
  } catch {
    return false;
  }
}
async function tryAcquireLock(lockPath, logger) {
  try {
    const payload = JSON.stringify({ pid: process.pid, ts: Date.now() });
    await (0, import_promises3.writeFile)(lockPath, payload, { flag: "wx" });
    return true;
  } catch (err) {
    const code = err.code;
    if (code !== "EEXIST") {
      logger.debug(`lock create failed (${code ?? "unknown"}): ${err}`);
      return false;
    }
  }
  try {
    const raw = await (0, import_promises3.readFile)(lockPath, "utf-8");
    const parsed = JSON.parse(raw);
    const age = Date.now() - (parsed.ts ?? 0);
    if (age > STALE_LOCK_MS) {
      await (0, import_promises3.unlink)(lockPath).catch(() => {
      });
      try {
        const payload = JSON.stringify({ pid: process.pid, ts: Date.now() });
        await (0, import_promises3.writeFile)(lockPath, payload, { flag: "wx" });
        return true;
      } catch {
        return false;
      }
    }
  } catch {
  }
  return false;
}

// ../core/src/sage-proxy.ts
function mapSageProxyOs(platform) {
  switch (platform) {
    case "win32":
      return "WINDOWS";
    case "darwin":
      return "MACOS";
    case "linux":
      return "LINUX";
    default:
      return platform;
  }
}
function mapSageProxyArchitecture(arch) {
  return arch.toUpperCase();
}
function buildSageProxyEnvelope(args) {
  return {
    identity: { uuid: args.iid },
    product: { version_app: args.versionApp },
    platform: {
      os: args.platformOs ?? mapSageProxyOs(process.platform),
      architecture: args.platformArchitecture ?? mapSageProxyArchitecture(process.arch)
    },
    agent: {
      agent_runtime: args.agentRuntime,
      agent_runtime_version: args.agentRuntimeVersion
    }
  };
}

// ../core/src/version.ts
var import_node_path14 = require("node:path");
var import_node_url = require("node:url");
var import_meta = {};
function resolveVersion() {
  if (true) return "0.11.0";
  try {
    const pkgPath = (0, import_node_path14.join)((0, import_node_path14.dirname)((0, import_node_url.fileURLToPath)(import_meta.url)), "..", "package.json");
    const pkg = JSON.parse(getFileContentSync(pkgPath));
    if (typeof pkg.version === "string") return pkg.version;
  } catch {
  }
  return "dev";
}
var VERSION = resolveVersion();

// ../core/src/clients/url-check.ts
var SERVICE_NAME = "sage";
function getProviderTld() {
  return "com";
}
function getProviderName() {
  return "avast";
}
function getSubdomain() {
  return "svc";
}
function buildDomain() {
  return [getSubdomain(), getProviderName(), getProviderTld()].join(".");
}
function resolveEndpoint(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `https://${SERVICE_NAME}-proxy.${buildDomain()}${normalizedPath}`;
}

// ../core/src/clients/model-manifest.ts
var DEFAULT_TIMEOUT_MS = 5e3;
async function fetchModelManifest(args) {
  const logger = args.logger ?? nullLogger;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!args.iid) {
    logger.debug("Skipping model manifest fetch: missing installation id");
    return null;
  }
  const envelope = buildSageProxyEnvelope({
    iid: args.iid,
    versionApp: args.versionApp ?? VERSION,
    agentRuntime: args.agentRuntime,
    agentRuntimeVersion: args.agentRuntimeVersion ?? "unknown"
  });
  const body = { ...envelope, models: { schema: args.schema } };
  try {
    const response = await fetch(resolveEndpoint("/v2/model-manifest"), {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      logger.debug(`Model manifest HTTP ${response.status}`);
      return null;
    }
    const parsed = await response.json();
    const schema = parsed.schema;
    if (typeof schema !== "string" || schema !== args.schema) {
      logger.debug("Model manifest: schema mismatch or missing", {
        requested: args.schema,
        received: typeof schema === "string" ? schema : null
      });
      return null;
    }
    const rawModels = parsed.models;
    if (!rawModels || typeof rawModels !== "object" || Array.isArray(rawModels)) {
      logger.debug("Model manifest: missing or malformed `models` field");
      return null;
    }
    const models = {};
    for (const [name, raw] of Object.entries(rawModels)) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw;
      const url = entry.url;
      const sha256 = entry.sha256;
      if (typeof url !== "string" || url.length === 0) {
        logger.warn(`Model manifest entry '${name}' missing url; skipping`);
        continue;
      }
      if (typeof sha256 !== "string" || sha256.length === 0) {
        logger.warn(`Model manifest entry '${name}' missing sha256; skipping`);
        continue;
      }
      models[name] = { url, sha256 };
    }
    return { schema, models };
  } catch (err) {
    logger.debug(`Model manifest fetch failed: ${err}`);
    return null;
  }
}

// ../core/src/model-download.ts
async function ensureModelsAvailable(args) {
  const logger = args.logger ?? nullLogger;
  const schema = args.schema ?? MODEL_SCHEMA_VERSION;
  const sageDir = args.sageDir;
  const required = REQUIRED_MODELS_BY_SCHEMA[schema] ?? [];
  if (required.length === 0) return [];
  const missing = missingRequiredModels(schema, sageDir);
  logger.debug("Model availability check started", {
    schema,
    requiredModels: required,
    missingModels: missing
  });
  if (missing.length === 0) {
    logger.debug("Model availability check completed", {
      schema,
      result: "already_available",
      installedModels: required
    });
    return [...required];
  }
  const manifest = await fetchModelManifest({
    iid: args.iid,
    schema,
    agentRuntime: args.agentRuntime ?? "unknown",
    agentRuntimeVersion: args.agentRuntimeVersion,
    versionApp: args.versionApp,
    logger
  });
  if (!manifest) {
    const installed2 = required.filter((name) => !missing.includes(name));
    logger.debug("Model availability check completed", {
      schema,
      result: "skipped",
      skippedReason: "manifest_unavailable",
      installedModels: installed2,
      missingModels: missing
    });
    return installed2;
  }
  const installed = new Set(required.filter((name) => !missing.includes(name)));
  for (const name of missing) {
    const entry = manifest.models[name];
    if (!entry) {
      logger.warn(`required model '${name}' missing from manifest; skipping`);
      continue;
    }
    try {
      const ok = await downloadModel({
        modelName: name,
        entry,
        schema,
        sageDir,
        logger
      });
      if (ok) installed.add(name);
    } catch (err) {
      logger.warn(`download of model '${name}' threw: ${err}`);
    }
  }
  const installedModels = [...installed];
  logger.debug("Model availability check completed", {
    schema,
    result: "checked",
    installedModels,
    missingModels: required.filter((name) => !installed.has(name))
  });
  return installedModels;
}

// ../core/src/jsonl-log-writer.ts
var import_promises5 = require("node:fs/promises");
var import_node_path15 = require("node:path");
var import_promises6 = require("node:timers/promises");
var writeQueues = /* @__PURE__ */ new Map();
var ROTATE_LOCK_TIMEOUT_MS = 250;
var ROTATE_LOCK_STALE_MS = 3e4;
var ROTATE_LOCK_POLL_MS = 50;
async function shouldRotate(filePath, maxBytes, maxFiles) {
  if (maxBytes <= 0 || maxFiles <= 0) return false;
  try {
    const s3 = await (0, import_promises5.stat)(filePath);
    return s3.size >= maxBytes;
  } catch {
    return false;
  }
}
async function removeStaleRotateLock(lockPath) {
  try {
    const s3 = await (0, import_promises5.stat)(lockPath);
    if (Date.now() - s3.mtimeMs < ROTATE_LOCK_STALE_MS) return;
    await (0, import_promises5.rmdir)(lockPath);
  } catch {
  }
}
async function acquireRotateLock(filePath) {
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + ROTATE_LOCK_TIMEOUT_MS;
  while (true) {
    try {
      await (0, import_promises5.mkdir)(lockPath);
      return async () => {
        try {
          await (0, import_promises5.rmdir)(lockPath);
        } catch {
        }
      };
    } catch {
      await removeStaleRotateLock(lockPath);
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) return void 0;
      await (0, import_promises6.setTimeout)(Math.min(ROTATE_LOCK_POLL_MS, remainingMs));
    }
  }
}
async function rotateIfNeeded(filePath, maxBytes, maxFiles) {
  if (!await shouldRotate(filePath, maxBytes, maxFiles)) return;
  const releaseLock = await acquireRotateLock(filePath);
  if (!releaseLock) return;
  try {
    if (!await shouldRotate(filePath, maxBytes, maxFiles)) return;
    try {
      await (0, import_promises5.unlink)(`${filePath}.${maxFiles}`);
    } catch {
    }
    for (let i = maxFiles - 1; i >= 1; i--) {
      try {
        await (0, import_promises5.rename)(`${filePath}.${i}`, `${filePath}.${i + 1}`);
      } catch {
      }
    }
    try {
      await (0, import_promises5.rename)(filePath, `${filePath}.1`);
    } catch {
    }
  } finally {
    await releaseLock();
  }
}
async function appendJsonlEntryNow(path, config, entry) {
  await (0, import_promises5.mkdir)((0, import_node_path15.dirname)(path), { recursive: true });
  await rotateIfNeeded(path, config.max_bytes, config.max_files);
  await (0, import_promises5.appendFile)(path, `${JSON.stringify(entry)}
`);
}
async function appendJsonlEntry(config, entry) {
  const path = resolvePath(config.path);
  const previousWrite = writeQueues.get(path) ?? Promise.resolve();
  const nextWrite = previousWrite.catch(() => {
  }).then(() => appendJsonlEntryNow(path, config, entry));
  writeQueues.set(path, nextWrite);
  try {
    await nextWrite;
  } finally {
    if (writeQueues.get(path) === nextWrite) writeQueues.delete(path);
  }
}

// ../core/src/operational-log.ts
var LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};
var FLUSH_TIMEOUT_MS = 250;
function shouldLog(config, level) {
  return config.enabled && LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[config.level];
}
function normalizeData(data) {
  if (!data) return void 0;
  const seen = /* @__PURE__ */ new WeakSet();
  try {
    return JSON.parse(
      JSON.stringify(data, (_key, value) => {
        if (typeof value === "bigint") return value.toString();
        if (value instanceof Error) {
          return { name: value.name, message: value.message, stack: value.stack };
        }
        if (value && typeof value === "object") {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
        }
        return value;
      })
    );
  } catch {
    return { serialization_error: "Failed to serialize log data" };
  }
}
async function writeOperationalLogEntry(config, entry) {
  if (!shouldLog(config, entry.level)) return;
  try {
    await appendJsonlEntry(config, entry);
  } catch {
  }
}
function createOperationalLogger(config, runtime) {
  const pendingWrites = /* @__PURE__ */ new Set();
  function log(component, level, message, data) {
    if (!shouldLog(config, level)) return;
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      runtime,
      component,
      message,
      ...data ? { data: normalizeData(data) } : {}
    };
    const write = writeOperationalLogEntry(config, entry);
    pendingWrites.add(write);
    void write.finally(() => pendingWrites.delete(write));
  }
  async function flush() {
    const deadline = Date.now() + FLUSH_TIMEOUT_MS;
    while (pendingWrites.size > 0) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) return;
      let timeout;
      try {
        const result = await Promise.race([
          Promise.allSettled([...pendingWrites]).then(() => "drained"),
          new Promise((resolve4) => {
            timeout = setTimeout(() => resolve4("timeout"), remainingMs);
            timeout.unref?.();
          })
        ]);
        if (result === "timeout") return;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
  }
  function forComponent(component) {
    return {
      debug(msg, data) {
        log(component, "debug", msg, data);
      },
      info(msg, data) {
        log(component, "info", msg, data);
      },
      warn(msg, data) {
        log(component, "warn", msg, data);
      },
      error(msg, data) {
        log(component, "error", msg, data);
      },
      flush
    };
  }
  return {
    debug(component, msg, data) {
      log(component, "debug", msg, data);
    },
    info(component, msg, data) {
      log(component, "info", msg, data);
    },
    warn(component, msg, data) {
      log(component, "warn", msg, data);
    },
    error(component, msg, data) {
      log(component, "error", msg, data);
    },
    forComponent,
    flush
  };
}

// ../core/src/model-download-worker.ts
async function readWorkerArgs() {
  const env = process.env;
  const sageDir = env.SAGE_DIR ? resolvePath(env.SAGE_DIR) : resolvePath("~/.sage");
  const agentRuntime = env.SAGE_AGENT_RUNTIME ?? "unknown";
  const agentRuntimeVersion = env.SAGE_AGENT_RUNTIME_VERSION || void 0;
  const versionApp = env.SAGE_VERSION_APP || void 0;
  const schema = env.SAGE_MODEL_SCHEMA || MODEL_SCHEMA_VERSION;
  return { sageDir, agentRuntime, agentRuntimeVersion, versionApp, schema };
}
async function createWorkerLogger(agentRuntime) {
  try {
    const config = await loadConfig();
    return createOperationalLogger(
      config.operational_logging,
      agentRuntime
    ).forComponent("model-download-worker");
  } catch {
    return nullLogger;
  }
}
async function workerMain() {
  const args = await readWorkerArgs();
  if (!args) return;
  const logger = await createWorkerLogger(args.agentRuntime);
  try {
    logger.debug("Model download worker started", {
      schema: args.schema,
      agentRuntime: args.agentRuntime,
      agentRuntimeVersion: args.agentRuntimeVersion,
      versionApp: args.versionApp
    });
    await (0, import_promises7.mkdir)(getModelStorageRoot(args.sageDir), { recursive: true }).catch(() => {
    });
    const iid = await getInstallationId(args.sageDir).catch(() => void 0);
    if (!iid) {
      logger.debug("Model download worker completed", {
        result: "skipped",
        skippedReason: "missing_installation_id"
      });
      await logger.flush?.();
      return;
    }
    const installedModels = await ensureModelsAvailable({
      sageDir: args.sageDir,
      iid,
      agentRuntime: args.agentRuntime,
      agentRuntimeVersion: args.agentRuntimeVersion,
      versionApp: args.versionApp,
      schema: args.schema,
      logger
    });
    logger.debug("Model download worker completed", {
      result: "completed",
      installedModels
    });
    await logger.flush?.();
  } catch (error) {
    logger.error("Model download worker failed open", {
      error: String(error),
      schema: args.schema,
      agentRuntime: args.agentRuntime,
      agentRuntimeVersion: args.agentRuntimeVersion,
      versionApp: args.versionApp
    });
    await logger.flush?.();
  }
}
var isWorkerEntry = (() => {
  try {
    const argv1 = process.argv[1] ?? "";
    const looksLikeWorker = argv1.endsWith("model-download-worker.cjs") || argv1.endsWith("model-download-worker.js");
    return looksLikeWorker && typeof process.env.SAGE_DIR === "string";
  } catch {
    return false;
  }
})();
if (isWorkerEntry) {
  workerMain().catch(() => {
    process.exit(0);
  });
}
//# sourceMappingURL=model-download-worker.cjs.map
