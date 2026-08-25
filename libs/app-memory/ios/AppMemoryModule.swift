import ExpoModulesCore
import MachO
import Foundation

public final class AppMemoryModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppMemory")

    AsyncFunction("getCurrentMemoryAsync") {
      var info = task_vm_info_data_t()
      var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
      let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
          task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
        }
      }
      guard result == KERN_SUCCESS else {
        throw NSError(domain: "AppMemory", code: Int(result), userInfo: [NSLocalizedDescriptionKey: "Unable to read process memory"])
      }

      return [
        "totalBytes": Double(ProcessInfo.processInfo.physicalMemory),
        "appFootprintBytes": Double(info.phys_footprint),
        "availableBytes": NSNull(),
      ]
    }
  }
}
