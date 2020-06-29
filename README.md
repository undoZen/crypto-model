# crypto-model

一个用来演示 model-container 这个状态管理、副作用管理框架的 demo 项目。

model-container 是基于 `redux`, `redux-saga`, `immer` 和 react hooks 的状态管理、副作用管理框架，这里没有新造的轮子，而只是讨论如何把现有的上面列举的这些库很好的整合起来。它的核心思想主要是：

1. 抽象一层，把 dva、vuex 等库的 module 分割做成 model 原型、需要给一个 instanceId 实例化之后才能用，于是把 redux 的状态管理做成类似面向对象的 class-instance 模式，避免了传统 redux 应用方式的各种 map selector combineReducer 等等难用的姿势；
2. 使用 `<Model.Provider>` 用 react 的 context 来自动初始化和使用实例，把父子组件的 props 传递干掉。

目前这里只是一个尝鲜版的 PoC 演示，会快速迭代更新，待较稳定时总结为 model-container 库。
