using System;
using System.Linq;
using System.Collections.Generic;
using System.Runtime.InteropServices;

using AOT;

using UnityEngine;
using UnityEngine.UI;

public class WebCamController : MonoBehaviour
{
    [DllImport("__Internal")]
    static extern void SetMindARCallBack(Action<int,float[]> cb);
    [RuntimeInitializeOnLoadMethod]
    static void Init() => SetMindARCallBack(MindARCallBack);

    static List<(int index,float[] matrix)> UpdateQue = new List<(int index,float[] matrix)>();

    [MonoPInvokeCallback(typeof(Action<int,float[]>))]
    static void MindARCallBack(int index,[MarshalAs(UnmanagedType.LPArray,SizeConst = 16)]float[] matrix) => UpdateQue.Add((index,matrix));
    
    public RawImage image;
    public TMPro.TMP_Text[] names;
    void Start()
    {
        var env = WebCamTexture.devices.FirstOrDefault((device) => !device.isFrontFacing);
        var texture = new WebCamTexture(env.name);
        image.texture = texture;
        texture.Play();
    }

    void Update()
    {
        foreach(var group in UpdateQue.GroupBy((pair) => pair.index,(pair) => pair.matrix))
        {
            Debug.Log((group.Key,group.Count()));
            var floats = group.LastOrDefault((m) => m != null);
            var nameText = names[group.Key];
            nameText.gameObject.SetActive(floats != null);
            if(floats == null)
                continue;

            var matrix = new Matrix4x4();
            foreach(var i in Enumerable.Range(0,floats.Length))
                matrix[i] = floats[i];

            nameText.transform.localRotation = matrix.rotation;
            nameText.transform.localPosition = matrix.GetPosition() / 10;

            nameText.text = nameText.name + "\n" + matrix.GetPosition();

            Debug.Log(nameText.transform.localPosition);
        }

        UpdateQue.Clear();
    }
}
