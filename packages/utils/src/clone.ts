/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 * @returns 新的拷贝对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }
  
  if (obj instanceof Array) {
    const cloneArr: any[] = []
    for (let i = 0; i < obj.length; i++) {
      cloneArr[i] = deepClone(obj[i])
    }
    return cloneArr as unknown as T
  }
  
  if (typeof obj === 'object') {
    const cloneObj: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloneObj[key] = deepClone(obj[key])
      }
    }
    return cloneObj as T
  }
  
  return obj
}